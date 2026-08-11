import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Sponsor } from '../src/sponsor/entities/sponsor.entity';
import { FollowUpSettings } from '../src/sponsor/entities/follow-up-settings.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

interface LoginResponseBody {
  accessToken: string;
}

// See mail.e2e-spec.ts for why this sleep is needed: JwtStrategy rejects a
// token whose iat (second precision) predates passwordChangedAt (ms
// precision), which same-second create+login always trips.
function sleepPastSecondBoundary(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

describe('Sponsorship matching, follow-up settings & preferences (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let sponsorsRepo: Repository<Sponsor>;
  let settingsRepo: Repository<FollowUpSettings>;

  let adminToken: string;
  let staffToken: string;
  let managerToken: string;
  let sponsorToken: string;
  let sponsorId: string;

  const suffix = Date.now();
  const createdUserEmails: string[] = [];
  const createdSponsorEmails: string[] = [];

  // follow_up_settings is a real, shared singleton row — captured and
  // restored so this suite doesn't leave the real follow-up delay changed.
  let settingsRowId: string;
  let originalDelayMinutes: number;

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
    settingsRepo = moduleFixture.get(getRepositoryToken(FollowUpSettings));

    const existingSettings = await settingsRepo.find({ take: 1 });
    settingsRowId = existingSettings[0]?.id;
    originalDelayMinutes = existingSettings[0]?.delayMinutes ?? 4320;

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
      sponsorsRepo.create({
        name: 'E2E Findable Sponsor',
        email: sponsorEmail,
      }),
    );
    sponsorId = sponsor.id;
    await request(app.getHttpServer())
      .post('/users/sponsor-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      // skipEmail avoids a real enqueued send racing this suite's app.close()
      // — see mail.processor's lazy sanitizer require, which can run after
      // Jest tears down the module registry if a job is still in flight.
      .send({ sponsorId: sponsor.id, password: 'password123', skipEmail: true })
      .expect(201);
    await sleepPastSecondBoundary();
    const sponsorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: sponsorEmail, password: 'password123' })
      .expect(200);
    sponsorToken = (sponsorLogin.body as LoginResponseBody).accessToken;
  }, 30000);

  afterAll(async () => {
    if (settingsRowId) {
      await settingsRepo.update(
        { id: settingsRowId },
        { delayMinutes: originalDelayMinutes },
      );
    }
    for (const email of createdUserEmails) {
      await usersRepo.delete({ email });
    }
    for (const email of createdSponsorEmails) {
      await sponsorsRepo.delete({ email });
    }
    await app.close();
  });

  describe('GET /sponsor (search)', () => {
    it('finds the sponsor by a partial name match', async () => {
      const res = await request(app.getHttpServer())
        .get('/sponsor?search=Findable')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      const results = res.body as { id: string }[];
      expect(results.some((s) => s.id === sponsorId)).toBe(true);
    });

    it('forbids staff and sponsor roles', async () => {
      await request(app.getHttpServer())
        .get('/sponsor')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/sponsor')
        .set('Authorization', `Bearer ${sponsorToken}`)
        .expect(403);
    });
  });

  describe('follow-up settings', () => {
    it('forbids staff and sponsor roles from reading or updating', async () => {
      await request(app.getHttpServer())
        .get('/follow-up-settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch('/follow-up-settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ delayMinutes: 7 })
        .expect(403);
      await request(app.getHttpServer())
        .get('/follow-up-settings')
        .set('Authorization', `Bearer ${sponsorToken}`)
        .expect(403);
    });

    it('lets an admin read and update the delay', async () => {
      const updated = await request(app.getHttpServer())
        .patch('/follow-up-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ delayMinutes: 10 })
        .expect(200);
      expect((updated.body as { delayMinutes: number }).delayMinutes).toBe(10);

      const read = await request(app.getHttpServer())
        .get('/follow-up-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((read.body as { delayMinutes: number }).delayMinutes).toBe(10);
    });

    it('lets a sponsorship manager read and update the delay', async () => {
      const updated = await request(app.getHttpServer())
        .patch('/follow-up-settings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ delayMinutes: 15 })
        .expect(200);
      expect((updated.body as { delayMinutes: number }).delayMinutes).toBe(15);

      const read = await request(app.getHttpServer())
        .get('/follow-up-settings')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect((read.body as { delayMinutes: number }).delayMinutes).toBe(15);
    });

    it('rejects an out-of-range delay', async () => {
      await request(app.getHttpServer())
        .patch('/follow-up-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ delayMinutes: 999999 })
        .expect(400);
    });
  });

  describe('PATCH /sponsor/me/preferences', () => {
    it('lets a sponsor save their own preferences', async () => {
      const res = await request(app.getHttpServer())
        .patch('/sponsor/me/preferences')
        .set('Authorization', `Bearer ${sponsorToken}`)
        .send({ childInterests: 'Football and drawing' })
        .expect(200);
      const body = res.body as {
        childInterests: string;
        preferencesCompletedAt: string | null;
      };
      expect(body.childInterests).toBe('Football and drawing');
      expect(body.preferencesCompletedAt).not.toBeNull();
    });

    it('forbids non-sponsor roles', async () => {
      await request(app.getHttpServer())
        .patch('/sponsor/me/preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ childInterests: 'x' })
        .expect(403);
    });
  });
});
