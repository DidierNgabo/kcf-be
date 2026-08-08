import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Sponsor } from '../src/sponsor/entities/sponsor.entity';
import { Child } from '../src/children/entities/child.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    sponsorId: string | null;
  };
}

interface SponsorAccountResponseBody {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    sponsorId: string | null;
  };
  temporaryPassword: string;
  emailSent: boolean;
}

describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let sponsorsRepo: Repository<Sponsor>;
  let childrenRepo: Repository<Child>;
  let adminToken: string;

  const suffix = Date.now();
  const createdUserEmails: string[] = [];
  const createdSponsorEmails: string[] = [];
  const createdChildIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    sponsorsRepo = moduleFixture.get(getRepositoryToken(Sponsor));
    childrenRepo = moduleFixture.get(getRepositoryToken(Child));

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
  });

  afterAll(async () => {
    for (const email of createdUserEmails) {
      await usersRepo.delete({ email });
    }
    for (const email of createdSponsorEmails) {
      await sponsorsRepo.delete({ email });
    }
    for (const id of createdChildIds) {
      await childrenRepo.delete({ id });
    }
    await app.close();
  });

  it('keeps the public routes open with no token', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/children').expect(200);
  });

  it('rejects a protected route with no token', async () => {
    await request(app.getHttpServer())
      .post('/children')
      .send({ name: 'No Token Child' })
      .expect(401);
  });

  it('allows an admin to create a child', async () => {
    const res = await request(app.getHttpServer())
      .post('/children')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Test Child',
        age: 10,
        imageUrl: 'https://example.com/child.jpg',
        bio: 'bio',
        subject: 'Math',
        dream: 'Doctor',
        hobby: 'Football',
        personality: 'Kind',
        family: 'Mother',
        location: 'Kigali',
        uniqueQuality: 'Curious',
      })
      .expect(201);
    createdChildIds.push((res.body as { id: string }).id);
  });

  it('rejects a staff-role token on sponsor-management routes (staff excluded)', async () => {
    const staffEmail = `staff-${suffix}@kcf.test`;
    createdUserEmails.push(staffEmail);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: staffEmail,
        password: 'password123',
        name: 'E2E Staff',
        role: UserRole.STAFF,
      })
      .expect(201);

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: staffEmail, password: 'password123' })
      .expect(200);
    const staffToken = (staffLogin.body as LoginResponseBody).accessToken;

    await request(app.getHttpServer())
      .get('/sponsor')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });

  it('scopes a sponsor-role user to only their own sponsor record via GET /sponsor/me', async () => {
    const sponsorAEmail = `sponsor-a-${suffix}@kcf.test`;
    const sponsorBEmail = `sponsor-b-${suffix}@kcf.test`;
    createdSponsorEmails.push(sponsorAEmail, sponsorBEmail);
    createdUserEmails.push(sponsorAEmail, sponsorBEmail);

    const sponsorA = await sponsorsRepo.save(
      sponsorsRepo.create({ name: 'Sponsor A', email: sponsorAEmail }),
    );
    const sponsorB = await sponsorsRepo.save(
      sponsorsRepo.create({ name: 'Sponsor B', email: sponsorBEmail }),
    );

    const accountAResponse = await request(app.getHttpServer())
      .post('/users/sponsor-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sponsorId: sponsorA.id, password: 'password123' })
      .expect(201);
    const accountA = accountAResponse.body as SponsorAccountResponseBody;

    const accountBResponse = await request(app.getHttpServer())
      .post('/users/sponsor-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sponsorId: sponsorB.id, password: 'password123' })
      .expect(201);
    const accountB = accountBResponse.body as SponsorAccountResponseBody;

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: sponsorAEmail, password: 'password123' })
      .expect(200);
    const tokenA = (loginA.body as LoginResponseBody).accessToken;

    const meAResponse = await request(app.getHttpServer())
      .get('/sponsor/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const meA = meAResponse.body as { id: string };

    expect(meA.id).toBe(sponsorA.id);
    expect(meA.id).not.toBe(sponsorB.id);

    await request(app.getHttpServer())
      .get('/sponsor')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    expect(accountA.user.sponsorId).toBe(sponsorA.id);
    expect(accountB.user.sponsorId).toBe(sponsorB.id);
  });

  it('returns the same generic response for forgot-password regardless of whether the email exists', async () => {
    const known = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: process.env.ADMIN_BOOTSTRAP_EMAIL })
      .expect(200);

    const unknown = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: `nobody-${suffix}@kcf.test` })
      .expect(200);

    expect(known.body).toEqual(unknown.body);
  });

  it('rejects reset-password with an invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'newpassword123' })
      .expect(401);
  });
});
