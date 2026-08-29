import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import * as path from 'path';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { QuerySponsorsDto } from './dto/query-sponsors.dto';
import { UpdateSponsorPreferencesDto } from './dto/update-sponsor-preferences.dto';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenService } from '../children/children.service';
import { Child } from '../children/entities/child.entity';
import { ConsentType } from '../children/enums/child.enums';
import { hasGrantedConsent } from '../children/consent.util';
import { MailService } from '../mail/mail.service';
import { EmailLog } from '../mail/entities/email-log.entity';
import { FollowUpService } from './follow-up.service';
import { STORAGE_SERVICE } from '../storage/storage.types';
import type { StorageService } from '../storage/storage.types';

const CONSENTED_PHOTO_PREFIX = 'email-assets/sponsor-photos/';

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name);

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly childrenService: ChildrenService,
    private readonly mailService: MailService,
    private readonly followUpService: FollowUpService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async submit(dto: CreateSponsorDto): Promise<void> {
    const { name, email, phone, message } = dto;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const year = String(now.getFullYear());

    let sponsor = await this.sponsorRepo.findOne({
      where: { email },
      loadEagerRelations: false,
    });
    if (sponsor) {
      Object.assign(sponsor, { name, phone, message });
    } else {
      sponsor = this.sponsorRepo.create({ name, email, phone, message });
    }
    sponsor = await this.sponsorRepo.save(sponsor);

    if (!sponsor.followUpSentAt) {
      await this.followUpService.sendFollowUpNow(sponsor);
    }

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
  }

  async findAll(query: QuerySponsorsDto): Promise<{
    data: Sponsor[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const qb = this.sponsorRepo
      .createQueryBuilder('sponsor')
      .leftJoinAndSelect('sponsor.child', 'child');

    if (query.search) {
      qb.andWhere(
        '(sponsor.name ILIKE :search OR sponsor.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.active === 'true') {
      qb.andWhere('sponsor.unsubscribed = false');
    }
    if (query.match === 'matched') {
      qb.andWhere('sponsor.childId IS NOT NULL');
    } else if (query.match === 'unmatched') {
      qb.andWhere('sponsor.childId IS NULL');
    }

    qb.orderBy('sponsor.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
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
      data: this.buildMatchedEmailData(
        dto.sponsorName,
        child,
        childPhotoUrl,
        year,
      ),
    });
  }

  // Shared by match() and resendEmail()'s 'sponsor.matched' branch, so the
  // field list only exists once.
  private buildMatchedEmailData(
    sponsorName: string,
    child: Child,
    childPhotoUrl: string | null,
    year: string,
  ): Record<string, unknown> {
    return {
      sponsorName,
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
    };
  }

  async listEmails(sponsorId: string): Promise<EmailLog[]> {
    const sponsor = await this.findById(sponsorId);
    return this.mailService.findByRecipient(sponsor.email);
  }

  async resendEmail(sponsorId: string, triggerKey: string): Promise<void> {
    const sponsor = await this.findById(sponsorId);
    const year = String(new Date().getFullYear());

    switch (triggerKey) {
      case 'sponsor.acknowledged':
        await this.mailService.send({
          triggerKey,
          to: sponsor.email,
          data: { name: sponsor.name, year },
        });
        return;

      case 'sponsor.matched': {
        if (!sponsor.child) {
          throw new ConflictException(
            'This sponsor has no matched child to resend a match email for',
          );
        }
        // Re-fetch fully (consents/media aren't loaded by the eager
        // Sponsor->Child relation) — same as match() does.
        const child = await this.childrenService.findEntityById(
          sponsor.child.id,
        );
        const childPhotoUrl = await this.resolveConsentedChildPhotoUrl(child);
        await this.mailService.send({
          triggerKey,
          to: sponsor.email,
          data: this.buildMatchedEmailData(
            sponsor.name,
            child,
            childPhotoUrl,
            year,
          ),
        });
        return;
      }

      case 'sponsor.profile-reminder':
        await this.followUpService.sendFollowUpNow(sponsor);
        return;

      default:
        throw new BadRequestException(
          `Resending trigger '${triggerKey}' is not supported`,
        );
    }
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
    if (dto.birthday) sponsor.birthdaySkipped = false;
    if (dto.birthdaySkipped) sponsor.birthday = null;

    if (!sponsor.preferencesCompletedAt) {
      const requiredChoices = [
        sponsor.childInterests,
        sponsor.schoolGoals,
        sponsor.childGenderPreference,
        sponsor.communicationPreferences,
      ];
      const allChoicesCompleted = requiredChoices.every(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );
      if (
        !allChoicesCompleted ||
        (!sponsor.birthday && !sponsor.birthdaySkipped)
      ) {
        throw new BadRequestException(
          'Complete every preference section before submitting',
        );
      }
      sponsor.preferencesCompletedAt = new Date();
    }
    let saved = await this.sponsorRepo.save(sponsor);

    if (!saved.acknowledgmentSentAt) {
      await this.mailService.send({
        triggerKey: 'sponsor.acknowledged',
        to: saved.email,
        data: { name: saved.name, year: String(new Date().getFullYear()) },
      });
      saved.acknowledgmentSentAt = new Date();
      saved = await this.sponsorRepo.save(saved);
    }
    return saved;
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

  async statistics(): Promise<{
    activeSponsors: number;
    completedProfiles: number;
    activeMatches: number;
    unmatchedSponsors: number;
    unsponsoredBeneficiaries: number;
    pendingEnquiries: number;
    sponsorshipStarts: { month: string; starts: number }[];
  }> {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const offset = index - 5;
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
      );
      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0),
      );
      return {
        start,
        end,
        month: start.toLocaleDateString('en-GB', {
          month: 'short',
          timeZone: 'UTC',
        }),
      };
    });
    const [
      activeSponsors,
      completedProfiles,
      activeMatches,
      unmatchedSponsors,
      unsponsoredBeneficiaries,
      pendingEnquiries,
      ...sponsorshipStartCounts
    ] = await Promise.all([
      this.sponsorRepo.count({ where: { unsubscribed: false } }),
      this.sponsorRepo.count({
        where: {
          unsubscribed: false,
          preferencesCompletedAt: Not(IsNull()),
        },
      }),
      this.sponsorRepo.count({
        where: { unsubscribed: false, child: Not(IsNull()) },
      }),
      this.sponsorRepo.count({
        where: { unsubscribed: false, child: IsNull() },
      }),
      this.childrenService.countUnsponsoredBeneficiaries(),
      this.sponsorRepo.count({
        where: { unsubscribed: false, followUpSentAt: IsNull() },
      }),
      ...months.map(({ start, end }) =>
        this.sponsorRepo.count({
          where: {
            unsubscribed: false,
            child: { sponsorshipStartDate: Between(start, end) },
          },
        }),
      ),
    ]);

    return {
      activeSponsors,
      completedProfiles,
      activeMatches,
      unmatchedSponsors,
      unsponsoredBeneficiaries,
      pendingEnquiries,
      sponsorshipStarts: months.map(({ month }, index) => ({
        month,
        starts: sponsorshipStartCounts[index],
      })),
    };
  }
}
