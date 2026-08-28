import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Child } from '../children/entities/child.entity';
import { ChildConsent } from '../children/entities/child-consent.entity';
import { ChildEducation } from '../children/entities/child-education.entity';
import { ChildGuardian } from '../children/entities/child-guardian.entity';
import { ChildImportRow } from '../children/entities/child-import-row.entity';
import { ChildImport } from '../children/entities/child-import.entity';
import { ChildMedia } from '../children/entities/child-media.entity';
import { Sponsor } from '../sponsor/entities/sponsor.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { EmailLayout } from '../mail/entities/email-layout.entity';
import { EmailTemplate } from '../mail/entities/email-template.entity';
import { EmailTemplateVersion } from '../mail/entities/email-template-version.entity';
import { EmailLog } from '../mail/entities/email-log.entity';
import { EmailAsset } from '../mail/entities/email-asset.entity';
import { AttendanceDay } from '../attendance/entities/attendance-day.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  entities: [
    Sponsor,
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
    EmailAsset,
    AttendanceDay,
    AttendanceRecord,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
