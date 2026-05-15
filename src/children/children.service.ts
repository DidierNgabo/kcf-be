import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from './entities/child.entity';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { children as seedData } from '../data/children';

@Injectable()
export class ChildrenService implements OnModuleInit {
  private readonly logger = new Logger(ChildrenService.name);

  constructor(
    @InjectRepository(Child)
    private readonly repo: Repository<Child>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;

    await this.repo.save(
      seedData.map((c) => this.repo.create({
        name: c.name,
        age: c.age,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
        imageUrl: c.imageUrl,
        bio: c.bio,
        subject: c.subject,
        dream: c.dream,
        hobby: c.hobby,
        personality: c.personality,
        family: c.family,
        location: c.location,
        uniqueQuality: c.uniqueQuality,
        schoolName: c.schoolName,
        schoolLevel: c.schoolLevel,
        schoolYearGroup: c.schoolYearGroup,
        enrolmentDate: c.enrolmentDate ? new Date(c.enrolmentDate) : null,
        guardianName: c.guardianName,
        guardianRelationship: c.guardianRelationship,
        guardianConsent: c.guardianConsent,
        photoConsentStatus: c.photoConsentStatus,
        sponsorshipStartDate: c.sponsorshipStartDate ? new Date(c.sponsorshipStartDate) : null,
      })),
    );
    this.logger.log(`Seeded ${seedData.length} children into database`);
  }

  findAll(): Promise<Child[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async create(dto: CreateChildDto): Promise<Child> {
    const child = this.repo.create({ ...dto });
    return this.repo.save(child);
  }

  async update(id: string, dto: UpdateChildDto): Promise<Child> {
    const child = await this.findById(id);
    Object.assign(child, dto);
    return this.repo.save(child);
  }

  async findById(id: string): Promise<Child> {
    const child = await this.repo.findOne({ where: { id } });
    if (!child) throw new NotFoundException(`Child with id "${id}" not found`);
    return child;
  }
}
