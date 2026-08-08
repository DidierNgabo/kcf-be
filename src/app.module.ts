import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SponsorModule } from './sponsor/sponsor.module';
import { ChildrenModule } from './children/children.module';
import { Child } from './children/entities/child.entity';
import { Sponsor } from './sponsor/entities/sponsor.entity';
import { FollowUpSettings } from './sponsor/entities/follow-up-settings.entity';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChildEducation } from './children/entities/child-education.entity';
import { ChildGuardian } from './children/entities/child-guardian.entity';
import { ChildConsent } from './children/entities/child-consent.entity';
import { ChildMedia } from './children/entities/child-media.entity';
import { ChildImport } from './children/entities/child-import.entity';
import { ChildImportRow } from './children/entities/child-import-row.entity';
import { AuditLog } from './audit/audit-log.entity';
import { AuditModule } from './audit/audit.module';
import { EmailLayout } from './mail/entities/email-layout.entity';
import { EmailTemplate } from './mail/entities/email-template.entity';
import { EmailTemplateVersion } from './mail/entities/email-template-version.entity';
import { EmailLog } from './mail/entities/email-log.entity';
import { MailModule } from './mail/mail.module';
import { AttendanceDay } from './attendance/entities/attendance-day.entity';
import { AttendanceRecord } from './attendance/entities/attendance-record.entity';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        Sponsor,
        FollowUpSettings,
        Child,
        User,
        ChildEducation,
        ChildGuardian,
        ChildConsent,
        ChildMedia,
        ChildImport,
        ChildImportRow,
        AuditLog,
        EmailLayout,
        EmailTemplate,
        EmailTemplateVersion,
        EmailLog,
        AttendanceDay,
        AttendanceRecord,
      ],
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
      retryAttempts: 10,
      retryDelay: 3000,
      extra: {
        // TCP keepalive so the OS detects dead connections before TypeORM reuses them
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        // Drop idle pool connections after 10 minutes so stale ones don't accumulate
        idleTimeoutMillis: 600000,
        connectionTimeoutMillis: 10000,
      },
    }),
    SponsorModule,
    ChildrenModule,
    UsersModule,
    AuthModule,
    AuditModule,
    MailModule,
    AttendanceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
