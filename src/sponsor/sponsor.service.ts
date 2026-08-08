import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository } from 'typeorm';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { QuerySponsorsDto } from './dto/query-sponsors.dto';
import { UpdateSponsorPreferencesDto } from './dto/update-sponsor-preferences.dto';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenService } from '../children/children.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name);

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly mailtrapContacts: MailtrapContactsService,
    private readonly childrenService: ChildrenService,
    private readonly mailService: MailService,
  ) {}

  async submit(dto: CreateSponsorDto): Promise<void> {
    console.log('Received sponsorship submission:', dto);
    const { name, email, phone, message } = dto;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const year = String(now.getFullYear());

    void this.mailService.send({
      triggerKey: 'sponsor.acknowledged',
      to: email,
      data: { name, year },
    });

    void this.mailService.send({
      triggerKey: 'sponsor.inquiry-received',
      to: process.env.NOTIFICATION_EMAIL!,
      data: {
        name,
        email,
        phone: phone || 'Not provided',
        message: message || 'None',
        date,
        year,
      },
    });

    try {
      await this.sponsorRepo.upsert(
        { email, name, phone: phone, message: message },
        ['email'],
      );
    } catch (err) {
      this.logger.error('Failed to save sponsor to database', err);
    }

    try {
      await this.mailtrapContacts.upsertContact(dto);
    } catch (err) {
      this.logger.error('Failed to save contact to Mailtrap', err);
    }
  }

  findAll(query?: QuerySponsorsDto): Promise<Sponsor[]> {
    if (!query?.search) {
      return this.sponsorRepo.find({ order: { createdAt: 'DESC' } });
    }
    return this.sponsorRepo.find({
      where: [
        { name: ILike(`%${query.search}%`) },
        { email: ILike(`%${query.search}%`) },
      ],
      order: { name: 'ASC' },
      take: query.limit,
    });
  }

  async findById(id: string): Promise<Sponsor> {
    const sponsor = await this.sponsorRepo.findOne({ where: { id } });
    if (!sponsor)
      throw new NotFoundException(`Sponsor with id "${id}" not found`);
    return sponsor;
  }

  async update(id: string, dto: UpdateSponsorDto): Promise<Sponsor> {
    const sponsor = await this.sponsorRepo.findOne({ where: { id } });
    if (!sponsor)
      throw new NotFoundException(`Sponsor with id "${id}" not found`);
    Object.assign(sponsor, dto);
    return this.sponsorRepo.save(sponsor);
  }

  async match(dto: MatchSponsorDto): Promise<void> {
    const child = await this.childrenService.findEntityById(dto.childId);

    let sponsor = await this.sponsorRepo.findOne({
      where: { email: dto.sponsorEmail },
    });
    if (!sponsor) {
      sponsor = this.sponsorRepo.create({
        name: dto.sponsorName,
        email: dto.sponsorEmail,
      });
    }
    sponsor.child = child;
    await this.sponsorRepo.save(sponsor);

    const year = String(new Date().getFullYear());

    void this.mailService.send({
      triggerKey: 'sponsor.matched',
      to: dto.sponsorEmail,
      data: {
        sponsorName: dto.sponsorName,
        childName: child.name,
        childAge: String(child.age),
        childSubject: child.subject ?? '',
        childDream: child.dream ?? '',
        childHobby: child.hobby ?? '',
        childPersonality: child.personality ?? '',
        childFamily: child.family ?? '',
        childLocation: child.location ?? '',
        childUniqueQuality: child.uniqueQuality ?? '',
        year,
      },
    });
  }

  async unsubscribeByToken(token: string): Promise<{ email: string }> {
    // unsubscribeToken is a uuid column — Postgres throws (not a graceful
    // "no match") if the value isn't UUID-shaped, so a malformed/tampered
    // token needs to be rejected before it ever reaches the query.
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        token,
      )
    ) {
      throw new NotFoundException('Invalid or already-used unsubscribe link');
    }

    const sponsor = await this.sponsorRepo.findOne({
      where: { unsubscribeToken: token },
    });
    if (!sponsor) {
      throw new NotFoundException('Invalid or already-used unsubscribe link');
    }
    if (!sponsor.unsubscribed) {
      sponsor.unsubscribed = true;
      sponsor.unsubscribedAt = new Date();
      await this.sponsorRepo.save(sponsor);
    }
    return { email: sponsor.email };
  }

  async updatePreferences(
    sponsorId: string,
    dto: UpdateSponsorPreferencesDto,
  ): Promise<Sponsor> {
    const sponsor = await this.findById(sponsorId);
    Object.assign(sponsor, dto);
    sponsor.preferencesCompletedAt = new Date();
    return this.sponsorRepo.save(sponsor);
  }

  async audienceCounts(): Promise<{
    all: number;
    matched: number;
    unmatched: number;
  }> {
    const [all, matched, unmatched] = await Promise.all([
      this.sponsorRepo.count({ where: { unsubscribed: false } }),
      this.sponsorRepo.count({
        where: { unsubscribed: false, child: Not(IsNull()) },
      }),
      this.sponsorRepo.count({
        where: { unsubscribed: false, child: IsNull() },
      }),
    ]);
    return { all, matched, unmatched };
  }
}
