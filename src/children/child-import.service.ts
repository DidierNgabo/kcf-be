import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { ChildrenService } from './children.service';
import { ChildImportRow } from './entities/child-import-row.entity';
import { ChildImport } from './entities/child-import.entity';
import { Child } from './entities/child.entity';
import { ImportAction, ImportStatus } from './enums/child.enums';
import { CHILD_IMPORT_PARSER } from './import/csv-parser';
import type { ChildImportParser } from './import/csv-parser';
import { ChildCsvMapper } from './import/child-csv.mapper';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ChildImportService {
  constructor(
    @InjectRepository(ChildImport) private readonly importRepo: Repository<ChildImport>,
    @InjectRepository(ChildImportRow) private readonly rowRepo: Repository<ChildImportRow>,
    @InjectRepository(Child) private readonly childRepo: Repository<Child>,
    private readonly childrenService: ChildrenService,
    @Inject(CHILD_IMPORT_PARSER) private readonly parser: ChildImportParser,
    private readonly mapper: ChildCsvMapper,
    private readonly audit: AuditService,
  ) {}

  async preview(file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('A CSV file is required');
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.importRepo.findOne({ where: { fileHash, uploadedByUserId: userId }, relations: { rows: true } });
    if (existing && existing.status === ImportStatus.COMPLETED) {
      throw new ConflictException('This CSV has already been committed');
    }
    if (existing) return this.toDto(existing);

    const rawRows = this.parser.parse(file.buffer);
    const numbers = rawRows.map((row) => (row['Number'] ?? '').trim()).filter(Boolean);
    const existingChildren = numbers.length
      ? await this.childRepo.createQueryBuilder('child')
          .leftJoinAndSelect('child.educationRecords', 'education')
          .leftJoinAndSelect('child.guardians', 'guardian')
          .leftJoinAndSelect('child.consents', 'consent')
          .where('child.kcfNumber IN (:...numbers)', { numbers }).getMany()
      : [];
    const byNumber = new Map(existingChildren.map((child) => [child.kcfNumber, child]));
    const batch = await this.importRepo.save(this.importRepo.create({
      originalFilename: file.originalname, fileHash, uploadedByUserId: userId,
      status: ImportStatus.PREVIEWED, totalRows: rawRows.length,
    }));

    const rows = rawRows.map((raw, index) => {
      const { normalized, errors, warnings } = this.mapper.normalize(raw);
      const existingChild = byNumber.get(normalized.kcfNumber as string);
      const action = errors.length
        ? ImportAction.INVALID
        : existingChild
          ? this.isUnchanged(existingChild, normalized) ? ImportAction.UNCHANGED : ImportAction.UPDATE
          : ImportAction.CREATE;
      return this.rowRepo.create({
        importBatch: batch, rowNumber: index + 2, kcfNumber: String(normalized.kcfNumber ?? ''),
        rawData: raw, normalizedData: normalized, errors, warnings, action,
        committed: false, childId: existingChild?.id ?? null,
      });
    });
    await this.rowRepo.save(rows);
    batch.rows = rows;
    batch.createCount = rows.filter((row) => row.action === ImportAction.CREATE).length;
    batch.updateCount = rows.filter((row) => row.action === ImportAction.UPDATE).length;
    batch.unchangedCount = rows.filter((row) => row.action === ImportAction.UNCHANGED).length;
    batch.invalidCount = rows.filter((row) => row.action === ImportAction.INVALID).length;
    await this.importRepo.save(batch);
    await this.audit.record('child.import.previewed', 'child_import', batch.id, userId, { totalRows: batch.totalRows, invalidRows: batch.invalidCount });
    return this.toDto(batch);
  }

  async findOne(id: string) {
    const batch = await this.importRepo.findOne({ where: { id }, relations: { rows: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    return this.toDto(batch);
  }

  async commit(id: string, userId: string) {
    const batch = await this.importRepo.findOne({ where: { id, uploadedByUserId: userId }, relations: { rows: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status === ImportStatus.COMPLETED) return this.toDto(batch);
    batch.status = ImportStatus.COMMITTING;
    await this.importRepo.save(batch);

    for (const row of batch.rows.sort((a, b) => a.rowNumber - b.rowNumber)) {
      if (row.committed || row.action === ImportAction.INVALID || row.action === ImportAction.UNCHANGED) continue;
      try {
        const payload = row.normalizedData as never;
        const result = row.childId
          ? await this.childrenService.update(row.childId, payload, userId)
          : await this.childrenService.create(payload, userId);
        row.childId = result.id;
        row.committed = true;
        await this.rowRepo.save(row);
      } catch (error) {
        row.errors = [...row.errors, error instanceof Error ? error.message : 'Commit failed'];
        row.action = ImportAction.INVALID;
        await this.rowRepo.save(row);
      }
    }
    batch.status = ImportStatus.COMPLETED;
    batch.committedCount = batch.rows.filter((row) => row.committed).length;
    batch.invalidCount = batch.rows.filter((row) => row.action === ImportAction.INVALID).length;
    await this.importRepo.save(batch);
    await this.audit.record('child.import.committed', 'child_import', batch.id, userId, { committedRows: batch.committedCount, invalidRows: batch.invalidCount });
    return this.findOne(batch.id);
  }

  async errorReport(id: string) {
    const batch = await this.importRepo.findOne({ where: { id }, relations: { rows: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = ['row,kcfNumber,errors,warnings'];
    for (const row of batch.rows.filter((item) => item.errors.length || item.warnings.length)) {
      lines.push([row.rowNumber, row.kcfNumber, row.errors.join('; '), row.warnings.join('; ')].map(quote).join(','));
    }
    return lines.join('\n');
  }

  private isUnchanged(child: Child, normalized: Record<string, unknown>) {
    const date = (value: Date | string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : undefined;
    const education = child.educationRecords?.find((item) => item.isCurrent);
    const guardian = child.guardians?.find((item) => item.isPrimary) ?? child.guardians?.[0];
    const expectedEducation = normalized.education as Record<string, unknown> | undefined;
    const expectedGuardians = normalized.guardians as Array<Record<string, unknown>> | undefined;
    const expectedGuardian = expectedGuardians?.[0];
    const expectedConsent = normalized.consent as Record<string, unknown> | undefined;
    const coreMatches = child.name === normalized.name && (child.gender ?? undefined) === normalized.gender
      && date(child.dateOfBirth) === normalized.dateOfBirth && date(child.enrolmentDate) === normalized.enrolmentDate;
    const educationMatches = !expectedEducation
      ? !education
      : (education?.schoolName ?? undefined) === expectedEducation.schoolName
        && (education?.schoolLevel ?? undefined) === expectedEducation.schoolLevel
        && (education?.yearGroup ?? undefined) === expectedEducation.yearGroup;
    const guardianMatches = !expectedGuardian
      ? !guardian
      : (guardian?.name ?? undefined) === expectedGuardian.name
        && guardian?.relationship === expectedGuardian.relationship;
    const latestConsent = (type: string) => child.consents
      ?.filter((item) => item.type === type)
      .sort((a, b) => +new Date(b.effectiveAt) - +new Date(a.effectiveAt))[0]?.status;
    const consentMatches = !expectedConsent ||
      (latestConsent('guardian') === expectedConsent.guardian && latestConsent('photo') === expectedConsent.photo);
    return coreMatches && educationMatches && guardianMatches && consentMatches;
  }

  private toDto(batch: ChildImport) {
    return {
      id: batch.id, filename: batch.originalFilename, status: batch.status,
      summary: { total: batch.totalRows, creates: batch.createCount, updates: batch.updateCount, unchanged: batch.unchangedCount, invalid: batch.invalidCount, committed: batch.committedCount },
      rows: (batch.rows ?? []).sort((a, b) => a.rowNumber - b.rowNumber).map((row) => ({
        id: row.id, rowNumber: row.rowNumber, kcfNumber: row.kcfNumber, action: row.action,
        normalizedData: row.normalizedData, errors: row.errors, warnings: row.warnings, committed: row.committed,
      })),
      createdAt: batch.createdAt,
    };
  }
}
