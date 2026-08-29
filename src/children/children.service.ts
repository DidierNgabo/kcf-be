import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { CreateChildDto } from './dto/create-child.dto';
import { QueryChildrenDto } from './dto/query-children.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildConsent } from './entities/child-consent.entity';
import { ChildEducation } from './entities/child-education.entity';
import { ChildGuardian } from './entities/child-guardian.entity';
import { Child } from './entities/child.entity';
import { ChildStatus, ConsentStatus, ConsentType } from './enums/child.enums';
import { latestConsentStatus } from './consent.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child) private readonly repo: Repository<Child>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryChildrenDto) {
    const qb = this.repo.createQueryBuilder('child')
      .leftJoinAndSelect('child.educationRecords', 'education')
      .leftJoinAndSelect('child.guardians', 'guardian')
      .leftJoinAndSelect('child.consents', 'consent')
      .leftJoinAndSelect('child.media', 'media')
      .leftJoinAndSelect('child.sponsors', 'sponsor')
      .distinct(true);
    if (query.search) {
      qb.andWhere(new Brackets((where) => where
        .where('child.name ILIKE :search')
        .orWhere('child.kcfNumber ILIKE :search')
        .orWhere('child.location ILIKE :search')
        .orWhere('education.schoolName ILIKE :search')), { search: `%${query.search}%` });
    }
    if (query.status) qb.andWhere('child.status = :status', { status: query.status });
    if (query.gender) qb.andWhere('child.gender = :gender', { gender: query.gender });
    if (query.schoolLevel) qb.andWhere('education.schoolLevel = :schoolLevel AND education.isCurrent = true', { schoolLevel: query.schoolLevel });
    const orderColumns = { name: 'child.name', kcfNumber: 'child.kcfNumber', dateOfBirth: 'child.dateOfBirth', createdAt: 'child.createdAt' };
    qb.orderBy(orderColumns[query.sortBy], query.sortOrder)
      .skip((query.page - 1) * query.limit).take(query.limit);
    const [children, total] = await qb.getManyAndCount();
    const [active, archived, incomplete] = await Promise.all([
      this.repo.count({ where: { status: ChildStatus.ACTIVE } }),
      this.repo.count({ where: { status: ChildStatus.ARCHIVED } }),
      this.repo.count({ where: { dateOfBirth: IsNull() } }),
    ]);
    return {
      data: children.map((child) => this.toDto(child)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      summary: { total, active, archived, incomplete },
    };
  }

  async findById(id: string) {
    const child = await this.findEntityById(id);
    return this.toDto(child);
  }

  async findEntityById(id: string) {
    const child = await this.repo.findOne({
      where: { id },
      relations: { educationRecords: true, guardians: true, consents: true, media: true, sponsors: true },
    });
    if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
    return child;
  }

  saveEntity(child: Child): Promise<Child> {
    return this.repo.save(child);
  }

  countUnsponsoredBeneficiaries(): Promise<number> {
    return this.repo
      .createQueryBuilder('child')
      .leftJoin(
        'child.sponsors',
        'sponsor',
        'sponsor.unsubscribed = :unsubscribed',
        { unsubscribed: false },
      )
      .where('child.status = :status', { status: ChildStatus.ACTIVE })
      .andWhere('sponsor.id IS NULL')
      .getCount();
  }

  async create(dto: CreateChildDto, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      if (dto.kcfNumber && await manager.exists(Child, { where: { kcfNumber: dto.kcfNumber } })) {
        throw new ConflictException(`KCF number "${dto.kcfNumber}" already exists`);
      }
      const child = manager.create(Child, { ...this.childFields(dto), kcfNumber: dto.kcfNumber ?? null });
      await manager.save(child);
      await this.replaceNested(manager, child, dto, userId);
      await this.audit.record('child.created', 'child', child.id, userId, { kcfNumber: child.kcfNumber }, manager);
      return this.findDtoWithManager(manager, child.id);
    });
  }

  async update(id: string, dto: UpdateChildDto, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const child = await manager.findOne(Child, { where: { id } });
      if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
      Object.assign(child, this.childFields(dto));
      await manager.save(child);
      await this.replaceNested(manager, child, dto, userId);
      await this.audit.record('child.updated', 'child', child.id, userId, {}, manager);
      return this.findDtoWithManager(manager, child.id);
    });
  }

  async archive(id: string, userId?: string) {
    const child = await this.repo.findOne({ where: { id } });
    if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
    child.status = ChildStatus.ARCHIVED;
    child.archivedAt = new Date();
    await this.repo.save(child);
    await this.audit.record('child.archived', 'child', id, userId);
    return this.findById(id);
  }

  async restore(id: string, userId?: string) {
    const child = await this.repo.findOne({ where: { id } });
    if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
    child.status = ChildStatus.ACTIVE;
    child.archivedAt = null;
    await this.repo.save(child);
    await this.audit.record('child.restored', 'child', id, userId);
    return this.findById(id);
  }

  private childFields(dto: Partial<CreateChildDto>) {
    const scalar = {
      name: dto.name,
      gender: dto.gender,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      enrolmentDate: dto.enrolmentDate ? new Date(dto.enrolmentDate) : undefined,
      bio: dto.bio, subject: dto.subject, dream: dto.dream, hobby: dto.hobby,
      personality: dto.personality, family: dto.family, location: dto.location,
      uniqueQuality: dto.uniqueQuality,
    };
    return Object.fromEntries(Object.entries(scalar).filter(([, value]) => value !== undefined));
  }

  private async replaceNested(
    manager: EntityManager,
    child: Child,
    dto: Partial<CreateChildDto>,
    userId?: string,
  ) {
    if (dto.education) {
      await manager.update(ChildEducation, { child: { id: child.id }, isCurrent: true }, { isCurrent: false, endedAt: new Date() });
      await manager.save(manager.create(ChildEducation, {
        child, schoolName: dto.education.schoolName ?? null,
        schoolLevel: dto.education.schoolLevel ?? null,
        yearGroup: dto.education.yearGroup ?? null,
        startedAt: dto.education.startedAt ? new Date(dto.education.startedAt) : null,
        endedAt: null, isCurrent: true,
      }));
    }
    if (dto.guardians) {
      await manager.delete(ChildGuardian, { child: { id: child.id } });
      await manager.save(dto.guardians.map((guardian) => manager.create(ChildGuardian, {
        child, name: guardian.name ?? null, relationship: guardian.relationship,
        phone: guardian.phone ?? null, email: guardian.email ?? null,
        isPrimary: guardian.isPrimary ?? false,
      })));
    }
    if (dto.consent) {
      const now = new Date();
      await manager.save([
        manager.create(ChildConsent, { child, type: ConsentType.GUARDIAN, status: dto.consent.guardian, effectiveAt: now, notes: dto.consent.notes ?? null, recordedByUserId: userId ?? null }),
        manager.create(ChildConsent, { child, type: ConsentType.PHOTO, status: dto.consent.photo, effectiveAt: now, notes: dto.consent.notes ?? null, recordedByUserId: userId ?? null }),
      ]);
    }
  }

  private async findDtoWithManager(manager: EntityManager, id: string) {
    const child = await manager.findOne(Child, {
      where: { id },
      relations: { educationRecords: true, guardians: true, consents: true, media: true, sponsors: true },
    });
    if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
    return this.toDto(child);
  }

  private toDto(child: Child) {
    const education = child.educationRecords?.find((record) => record.isCurrent) ?? null;
    const latestConsent = (type: ConsentType) => latestConsentStatus(child.consents, type);
    return {
      id: child.id, kcfNumber: child.kcfNumber, name: child.name, age: child.age,
      gender: child.gender, dateOfBirth: child.dateOfBirth, enrolmentDate: child.enrolmentDate,
      status: child.status, archivedAt: child.archivedAt, profileMediaId: child.profileMediaId,
      imageUrl: child.imageUrl, bio: child.bio, subject: child.subject, dream: child.dream,
      hobby: child.hobby, personality: child.personality, family: child.family,
      location: child.location, uniqueQuality: child.uniqueQuality,
      education, guardians: child.guardians ?? [], consents: child.consents ?? [],
      media: (child.media ?? []).filter((item) => !item.archivedAt),
      consentStatus: { guardian: latestConsent(ConsentType.GUARDIAN), photo: latestConsent(ConsentType.PHOTO) },
      schoolName: education?.schoolName ?? null, schoolLevel: education?.schoolLevel ?? null,
      schoolYearGroup: education?.yearGroup ?? null,
      guardianName: child.guardians?.find((item) => item.isPrimary)?.name ?? child.guardians?.[0]?.name ?? null,
      guardianRelationship: child.guardians?.find((item) => item.isPrimary)?.relationship ?? child.guardians?.[0]?.relationship ?? null,
      guardianConsent: latestConsent(ConsentType.GUARDIAN) === ConsentStatus.GRANTED,
      photoConsentStatus: latestConsent(ConsentType.PHOTO) === ConsentStatus.GRANTED,
      sponsored: Boolean(child.sponsors?.some((sponsor) => !sponsor.unsubscribed)),
      sponsorshipStartDate: child.sponsorshipStartDate,
      createdAt: child.createdAt, updatedAt: child.updatedAt,
    };
  }
}
