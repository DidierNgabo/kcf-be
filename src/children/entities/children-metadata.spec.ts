import { DataSource } from 'typeorm';
import { AuditLog } from '../../audit/audit-log.entity';
import { Sponsor } from '../../sponsor/entities/sponsor.entity';
import { User } from '../../users/entities/user.entity';
import { ChildConsent } from './child-consent.entity';
import { ChildEducation } from './child-education.entity';
import { ChildGuardian } from './child-guardian.entity';
import { ChildImportRow } from './child-import-row.entity';
import { ChildImport } from './child-import.entity';
import { ChildMedia } from './child-media.entity';
import { Child } from './child.entity';

describe('TypeORM entity metadata', () => {
  it('maps every decorated field to a PostgreSQL-supported type', async () => {
    const source = new DataSource({
      type: 'postgres',
      entities: [Sponsor, User, Child, ChildEducation, ChildGuardian, ChildConsent, ChildMedia, ChildImport, ChildImportRow, AuditLog],
    });
    await (source as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
    expect(source.entityMetadatas).toHaveLength(10);
  });
});
