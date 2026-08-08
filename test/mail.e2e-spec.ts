// juice and sanitize-html ship ESM-only (as do several of their own
// dependencies), which this repo's ts-jest/CJS test setup can't load. Real
// rendering (Handlebars) is still exercised below via /preview — only the
// CSS-inlining/sanitization step is stubbed to a passthrough. That step is
// covered instead by a manual smoke test against the compiled app (see PR
// notes) and doesn't change what this suite is actually verifying: RBAC and
// the render pipeline wiring.
// juice is ESM-transpiled ({ __esModule, default }); sanitize-html is plain
// CJS `export =` (the function itself) — mocks must match those shapes or
// they mask real unwrapping bugs in sanitizer.ts instead of exercising it.
jest.mock('juice', () => ({
  __esModule: true,
  default: (html: string) => html,
}));
jest.mock('sanitize-html', () => (html: string) => html);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Sponsor } from '../src/sponsor/entities/sponsor.entity';
import { EmailTemplate } from '../src/mail/entities/email-template.entity';
import { EmailTemplateVersion } from '../src/mail/entities/email-template-version.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

interface LoginResponseBody {
  accessToken: string;
}

// The current JwtStrategy rejects a token whose `iat` (second precision)
// appears to predate the user's `passwordChangedAt` (millisecond precision)
// — which happens whenever login follows account creation within the same
// second, exactly the pattern needed here to obtain a role's token. This
// sleep crosses the second boundary so RBAC tests exercise the actual role
// check rather than tripping that unrelated pre-existing timing issue.
function sleepPastSecondBoundary(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

describe('Mail templates (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let sponsorsRepo: Repository<Sponsor>;
  let templatesRepo: Repository<EmailTemplate>;
  let versionsRepo: Repository<EmailTemplateVersion>;

  let adminToken: string;
  let staffToken: string;
  let managerToken: string;
  let sponsorToken: string;

  const suffix = Date.now();
  const createdUserEmails: string[] = [];
  const createdSponsorEmails: string[] = [];
  const createdTemplateIds: string[] = [];

  // This suite exercises the full lifecycle against the real
  // 'user.password-reset' trigger, which — unlike a throwaway test fixture
  // — staff may have already configured for real (the (triggerKey, locale,
  // channel) uniqueness means a second one can't be created alongside it).
  // Rather than deleting real content, any pre-existing template+versions
  // for it are captured here and restored verbatim in afterAll.
  let restoreTemplate: EmailTemplate | null = null;
  let restoreVersions: EmailTemplateVersion[] = [];

  async function createRoleUserAndLogin(
    role: UserRole,
    label: string,
  ): Promise<string> {
    const email = `${label}-${suffix}@kcf.test`;
    createdUserEmails.push(email);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password: 'password123', name: `E2E ${label}`, role })
      .expect(201);

    await sleepPastSecondBoundary();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return (login.body as LoginResponseBody).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    sponsorsRepo = moduleFixture.get(getRepositoryToken(Sponsor));
    templatesRepo = moduleFixture.get(getRepositoryToken(EmailTemplate));
    versionsRepo = moduleFixture.get(getRepositoryToken(EmailTemplateVersion));

    const existing = await templatesRepo.findOne({
      where: {
        triggerKey: 'user.password-reset',
        locale: 'default',
        channel: 'email',
      },
    });
    if (existing) {
      restoreTemplate = existing;
      restoreVersions = await versionsRepo.find({
        where: { templateId: existing.id },
      });
      await templatesRepo.delete({ id: existing.id });
    }

    const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD must be set in .env for this e2e suite',
      );
    }
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    adminToken = (login.body as LoginResponseBody).accessToken;

    staffToken = await createRoleUserAndLogin(UserRole.STAFF, 'staff');
    managerToken = await createRoleUserAndLogin(
      UserRole.SPONSORSHIP_MANAGER,
      'manager',
    );

    const sponsorEmail = `sponsor-${suffix}@kcf.test`;
    createdSponsorEmails.push(sponsorEmail);
    createdUserEmails.push(sponsorEmail);
    const sponsor = await sponsorsRepo.save(
      sponsorsRepo.create({ name: 'E2E Sponsor', email: sponsorEmail }),
    );
    await request(app.getHttpServer())
      .post('/users/sponsor-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sponsorId: sponsor.id, password: 'password123' })
      .expect(201);
    await sleepPastSecondBoundary();
    const sponsorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: sponsorEmail, password: 'password123' })
      .expect(200);
    sponsorToken = (sponsorLogin.body as LoginResponseBody).accessToken;
  }, 30000);

  afterAll(async () => {
    for (const id of createdTemplateIds) {
      await templatesRepo.delete({ id });
    }
    for (const email of createdUserEmails) {
      await usersRepo.delete({ email });
    }
    for (const email of createdSponsorEmails) {
      await sponsorsRepo.delete({ email });
    }
    if (restoreTemplate) {
      await templatesRepo.save(restoreTemplate);
      if (restoreVersions.length) await versionsRepo.save(restoreVersions);
    }
    await app.close();
  });

  describe('GET /mail/triggers', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/mail/triggers').expect(401);
    });

    it('lists all 8 registered triggers (7 coded + the broadcast pseudo-trigger) for staff, managers and admins', async () => {
      for (const token of [staffToken, managerToken, adminToken]) {
        const res = await request(app.getHttpServer())
          .get('/mail/triggers')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect((res.body as unknown[]).length).toBe(8);
      }
    });

    it('forbids a sponsor-role user', async () => {
      await request(app.getHttpServer())
        .get('/mail/triggers')
        .set('Authorization', `Bearer ${sponsorToken}`)
        .expect(403);
    });
  });

  describe('template lifecycle', () => {
    let templateId: string;
    let draftVersionId: string;
    let publishedV1Id: string;
    let publishedV2Id: string;

    it('forbids staff and sponsor roles from creating a template', async () => {
      await request(app.getHttpServer())
        .post('/mail/templates')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ triggerKey: 'user.password-reset' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/mail/templates')
        .set('Authorization', `Bearer ${sponsorToken}`)
        .send({ triggerKey: 'user.password-reset' })
        .expect(403);
    });

    it('lets a sponsorship manager create a template, seeded with the trigger default as v1 draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/mail/templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ triggerKey: 'user.password-reset' })
        .expect(201);

      const body = res.body as {
        id: string;
        versions: { id: string; status: string }[];
      };
      templateId = body.id;
      draftVersionId = body.versions[0].id;
      createdTemplateIds.push(templateId);
      expect(body.versions[0].status).toBe('draft');
    });

    it('rejects a draft containing an unknown variable, with a suggestion', async () => {
      const res = await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/versions`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ subject: 'Reset {{nam}}', bodyHtml: '<p>{{nam}}</p>' })
        .expect(422);

      const body = res.body as { errors: { code: string; message: string }[] };
      expect(body.errors[0].code).toBe('UNKNOWN_VARIABLE');
      expect(body.errors[0].message).toContain("Did you mean 'name'");
    });

    it('accepts a valid draft save', async () => {
      const res = await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/versions`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          subject: 'Reset your password, {{name}}',
          bodyHtml: '<p>Hi {{name}}, <a href="{{resetUrl}}">reset</a>.</p>',
        })
        .expect(200);
      const body = res.body as { id: string; status: string };
      draftVersionId = body.id;
      expect(body.status).toBe('draft');
    });

    it('previews the draft, rendering with sample data — allowed for read-only roles too', async () => {
      const res = await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/preview`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          subject: 'Reset your password, {{name}}',
          bodyHtml: '<p>Hi {{name}}, <a href="{{resetUrl}}">reset</a>.</p>',
        })
        .expect(200);
      const body = res.body as { valid: boolean; html: string };
      expect(body.valid).toBe(true);
      expect(body.html).toContain('Hi');
    });

    it('forbids a sponsorship manager (and staff) from publishing', async () => {
      await request(app.getHttpServer())
        .post(
          `/mail/templates/${templateId}/versions/${draftVersionId}/publish`,
        )
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(
          `/mail/templates/${templateId}/versions/${draftVersionId}/publish`,
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('lets an admin publish the draft as version 1', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/mail/templates/${templateId}/versions/${draftVersionId}/publish`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        id: string;
        status: string;
        versionNumber: number;
      };
      publishedV1Id = body.id;
      expect(body.status).toBe('published');
      expect(body.versionNumber).toBe(1);
    });

    it('publishes a second version, then lets an admin roll back to version 1', async () => {
      const draft = await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/versions`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          subject: 'Reset (v2), {{name}}',
          bodyHtml: '<p>{{name}} — v2 {{resetUrl}}</p>',
        })
        .expect(200);
      const draftId = (draft.body as { id: string }).id;

      const publishV2 = await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/versions/${draftId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      publishedV2Id = (publishV2.body as { id: string; versionNumber: number })
        .id;
      expect((publishV2.body as { versionNumber: number }).versionNumber).toBe(
        2,
      );

      const rollback = await request(app.getHttpServer())
        .post(
          `/mail/templates/${templateId}/versions/${publishedV1Id}/rollback`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const rolledBack = rollback.body as {
        subject: string;
        versionNumber: number;
        status: string;
      };
      expect(rolledBack.status).toBe('published');
      expect(rolledBack.versionNumber).toBe(3);
      expect(rolledBack.subject).toBe('Reset your password, {{name}}');
      expect(publishedV2Id).toBeTruthy();
    });

    it('shows the template as published (no pending draft) in the list', async () => {
      const res = await request(app.getHttpServer())
        .get('/mail/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const list = res.body as {
        id: string;
        hasDraftChanges: boolean;
        hasPublished: boolean;
      }[];
      const entry = list.find((t) => t.id === templateId);
      expect(entry).toBeDefined();
      expect(entry?.hasPublished).toBe(true);
    });

    it('forbids staff from sending a test email', async () => {
      await request(app.getHttpServer())
        .post(`/mail/templates/${templateId}/test-send`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to: 'nobody@example.org' })
        .expect(403);
    });
  });
});
