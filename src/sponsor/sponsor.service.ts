import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository } from 'typeorm';
import * as path from 'path';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { QuerySponsorsDto } from './dto/query-sponsors.dto';
import { UpdateSponsorPreferencesDto } from './dto/update-sponsor-preferences.dto';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenService } from '../children/children.service';
import { Child } from '../children/entities/child.entity';
import { ConsentType } from '../children/enums/child.enums';
import { hasGrantedConsent } from '../children/consent.util';
import { MailService } from '../mail/mail.service';
import { STORAGE_SERVICE } from '../storage/storage.types';
import type { StorageService } from '../storage/storage.types';

const CONSENTED_PHOTO_PREFIX = 'email-assets/sponsor-photos/';

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name);

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly mailtrapContacts: MailtrapContactsService,
    private readonly childrenService: ChildrenService,
    private readonly mailService: MailService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
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
    if (!child.sponsorshipStartDate) child.sponsorshipStartDate = new Date();
    await this.childrenService.saveEntity(child);
    sponsor.child = child;
    await this.sponsorRepo.save(sponsor);

    const year = String(new Date().getFullYear());
    const childPhotoUrl = await this.resolveConsentedChildPhotoUrl(child);

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
        // Always present (never omitted) so it overrides the trigger's
        // sample default during mergeContext's deep-merge — an omitted key
        // would silently fall back to the *sample* photo URL, not to "no
        // photo". An empty string is falsy in the template's {{#if}}.
        childPhotoUrl: childPhotoUrl ?? '',
        year,
      },
    });
  }

  // Only ever exposes a child's photo when a guardian has granted photo
  // consent — the DB already tracks this per child (ConsentType.PHOTO) but
  // nothing enforced it before this email existed. Copies the consented
  // photo into the same public prefix the branded email assets already use
  // (rather than building a public URL straight off the private
  // children/{childId}/... key), so a declined/withdrawn consent can never
  // retroactively make an already-private object key resolvable — only a
  // deliberate, consent-gated copy is ever public. Falls back to null (the
  // template's generic hero photo) on missing consent, missing photo, or
  // any storage error — a photo-copy failure must never block the match
  // email itself.
  private async resolveConsentedChildPhotoUrl(
    child: Child,
  ): Promise<string | null> {
    if (!hasGrantedConsent(child.consents, ConsentType.PHOTO)) return null;
    const photo = child.media?.find(
      (item) => item.id === child.profileMediaId && !item.archivedAt,
    );
    if (!photo) return null;

    try {
      const extension = path.extname(photo.objectKey) || '.jpg';
      const destinationKey = `${CONSENTED_PHOTO_PREFIX}${child.id}${extension}`;
      await this.storage.copyObject(photo.objectKey, destinationKey);
      return this.storage.getPublicUrl(destinationKey);
    } catch (err) {
      this.logger.warn(
        `Could not prepare consented photo for child ${child.id}; falling back to the generic hero photo`,
        err instanceof Error ? err.stack : err,
      );
      return null;
    }
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
