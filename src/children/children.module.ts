import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Child } from './entities/child.entity';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { ChildEducation } from './entities/child-education.entity';
import { ChildGuardian } from './entities/child-guardian.entity';
import { ChildConsent } from './entities/child-consent.entity';
import { ChildMedia } from './entities/child-media.entity';
import { ChildImport } from './entities/child-import.entity';
import { ChildImportRow } from './entities/child-import-row.entity';
import { ChildMediaService } from './child-media.service';
import { ChildImportService } from './child-import.service';
import { StorageModule } from '../storage/storage.module';
import { CHILD_IMPORT_PARSER, StandardCsvParser } from './import/csv-parser';
import { ChildCsvMapper } from './import/child-csv.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Child, ChildEducation, ChildGuardian, ChildConsent, ChildMedia,
      ChildImport, ChildImportRow,
    ]),
    StorageModule,
  ],
  controllers: [ChildrenController],
  providers: [
    ChildrenService, ChildMediaService, ChildImportService, ChildCsvMapper,
    StandardCsvParser, { provide: CHILD_IMPORT_PARSER, useExisting: StandardCsvParser },
  ],
  exports: [ChildrenService],
})
export class ChildrenModule {}
