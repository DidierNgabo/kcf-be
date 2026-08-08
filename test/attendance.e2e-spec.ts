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
import { AttendanceDay } from '../src/attendance/entities/attendance-day.entity';
import { AttendanceRecord } from '../src/attendance/entities/attendance-record.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { ChildStatus } from '../src/children/enums/child.enums';

interface LoginResponseBody {
  accessToken: string;
}

// See mail.e2e-spec.ts / sponsorship.e2e-spec.ts for why this sleep is
// needed: JwtStrategy rejects a token whose iat (second precision) predates
// passwordChangedAt (ms precision), which same-second create+login trips.
function sleepPastSecondBoundary(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

describe('Attendance (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let sponsorsRepo: Repository<Sponsor>;
  let childrenRepo: Repository<Child>;
  let daysRepo: Repository<AttendanceDay>;
  let recordsRepo: Repository<AttendanceRecord>;

  let adminToken: string;
  let staffToken: string;
  let sponsorToken: string;
  let childId: string;
  let secondChildId: string;
  let sponsorEmail: string;

  const suffix = Date.now();
  // A date far in the past so it can never collide with a real gathering day
  // staff might be actively using in the shared dev DB.
  const testDate = '2000-01-01';
  const createdUserEmails: string[] = [];

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
    childrenRepo = moduleFixture.get(getRepositoryToken(Child));
    daysRepo = moduleFixture.get(getRepositoryToken(AttendanceDay));
    recordsRepo = moduleFixture.get(getRepositoryToken(AttendanceRecord));

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

    // Sponsor-role users can't be created via POST /users (CreateUserDto
    // restricts `role` to STAFF_ROLES) — a sponsor login needs a real
    // Sponsor row first, then POST /users/sponsor-accounts, exactly like
    // sponsorship.e2e-spec.ts's setup.
    sponsorEmail = `sponsor-${suffix}@kcf.test`;
    createdUserEmails.push(sponsorEmail);
    const sponsor = await sponsorsRepo.save(
      sponsorsRepo.create({
        name: 'E2E Attendance Sponsor',
        email: sponsorEmail,
      }),
    );
    await request(app.getHttpServer())
      .post('/users/sponsor-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sponsorId: sponsor.id, password: 'password123', skipEmail: true })
      .expect(201);
    await sleepPastSecondBoundary();
    const sponsorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: sponsorEmail, password: 'password123' })
      .expect(200);
    sponsorToken = (sponsorLogin.body as LoginResponseBody).accessToken;

    const child = await childrenRepo.save(
      childrenRepo.create({
        name: `E2E Attendance Child ${suffix}`,
        status: ChildStatus.ACTIVE,
      }),
    );
    childId = child.id;

    const secondChild = await childrenRepo.save(
      childrenRepo.create({
        name: `E2E Attendance Child B ${suffix}`,
        status: ChildStatus.ACTIVE,
      }),
    );
    secondChildId = secondChild.id;
  }, 30000);

  afterAll(async () => {
    const day = await daysRepo.findOne({
      where: { date: testDate as unknown as Date },
    });
    if (day) {
      await recordsRepo.delete({ attendanceDayId: day.id });
      await daysRepo.delete({ id: day.id });
    }
    await childrenRepo.delete({ id: childId });
    await childrenRepo.delete({ id: secondChildId });
    for (const email of createdUserEmails) {
      await usersRepo.delete({ email });
    }
    await sponsorsRepo.delete({ email: sponsorEmail });
    await app.close();
  });

  describe('RBAC', () => {
    it('forbids a sponsor from viewing or marking attendance', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${sponsorToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/attendance/days/${testDate}/records`)
        .set('Authorization', `Bearer ${sponsorToken}`)
        .send({ childId })
        .expect(403);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .expect(401);
    });
  });

  describe('day lifecycle', () => {
    it('shows the child pending before anyone marks a status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = res.body as {
        roster: { childId: string; status: string }[];
      };
      const entry = body.roster.find((r) => r.childId === childId);
      expect(entry?.status).toBe('pending');
    });

    it('sets the child Late with a note and reflects it in the day roster', async () => {
      await request(app.getHttpServer())
        .post(`/attendance/days/${testDate}/records`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ childId, status: 'late', note: 'Bus delayed' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = res.body as {
        lateCount: number;
        roster: { childId: string; status: string; note: string | null }[];
      };
      const entry = body.roster.find((r) => r.childId === childId);
      expect(entry?.status).toBe('late');
      expect(entry?.note).toBe('Bus delayed');
      expect(body.lateCount).toBeGreaterThanOrEqual(1);
    });

    it('changes the status without losing the note when note is omitted', async () => {
      await request(app.getHttpServer())
        .post(`/attendance/days/${testDate}/records`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ childId, status: 'present' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = res.body as {
        presentCount: number;
        roster: { childId: string; status: string; note: string | null }[];
      };
      const entry = body.roster.find((r) => r.childId === childId);
      expect(entry?.status).toBe('present');
      expect(entry?.note).toBe('Bus delayed');
      expect(body.presentCount).toBe(1);
    });

    it("labels the day and reflects the status/note/rate in the child's history", async () => {
      await request(app.getHttpServer())
        .patch(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'E2E Special Gathering' })
        .expect(200);

      const history = await request(app.getHttpServer())
        .get(`/attendance/children/${childId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = history.body as {
        totalPresent: number;
        attendanceRatePercent: number;
        records: {
          date: string;
          label: string | null;
          status: string;
          note: string | null;
        }[];
      };
      expect(body.totalPresent).toBe(1);
      expect(body.attendanceRatePercent).toBeGreaterThan(0);
      expect(body.records[0].date).toBe(testDate);
      expect(body.records[0].label).toBe('E2E Special Gathering');
      expect(body.records[0].status).toBe('present');
      expect(body.records[0].note).toBe('Bus delayed');
    });

    it('exports CSV and PDF for the day, including the note', async () => {
      const csv = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}/export.csv`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('Present');
      expect(csv.text).toContain('Bus delayed');

      const pdf = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}/export.pdf`)
        .set('Authorization', `Bearer ${staffToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      // Regression guard: a returned Buffer that Nest JSON-serializes
      // instead of streaming as raw bytes (a real bug caught via manual
      // testing once) would fail this exact check.
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });

    it('marks the remaining pending children present in one call', async () => {
      const before = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(
        (
          before.body as { roster: { childId: string; status: string }[] }
        ).roster.find((r) => r.childId === secondChildId)?.status,
      ).toBe('pending');

      await request(app.getHttpServer())
        .post(`/attendance/days/${testDate}/mark-remaining`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = after.body as {
        pendingCount: number;
        roster: { childId: string; status: string }[];
      };
      expect(body.roster.find((r) => r.childId === secondChildId)?.status).toBe(
        'present',
      );
      expect(body.pendingCount).toBe(0);
    });

    it('unmarks the child and it drops back to pending', async () => {
      await request(app.getHttpServer())
        .delete(`/attendance/days/${testDate}/records/${childId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = res.body as {
        roster: { childId: string; status: string }[];
      };
      expect(body.roster.find((r) => r.childId === childId)?.status).toBe(
        'pending',
      );
    });

    it('resets the day, clearing every remaining record back to pending', async () => {
      await request(app.getHttpServer())
        .delete(`/attendance/days/${testDate}/records`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/attendance/days/${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const body = res.body as {
        pendingCount: number;
        totalActive: number;
        roster: { childId: string; status: string }[];
      };
      expect(body.pendingCount).toBe(body.totalActive);
      expect(body.roster.every((r) => r.status === 'pending')).toBe(true);
    });
  });
});
