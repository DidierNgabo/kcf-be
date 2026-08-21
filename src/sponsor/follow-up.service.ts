import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Sponsor } from './entities/sponsor.entity';
import { FollowUpSettings } from './entities/follow-up-settings.entity';
import { UpdateFollowUpSettingsDto } from './dto/update-follow-up-settings.dto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

const MINUTE_MS = 60 * 1000;

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    @InjectRepository(FollowUpSettings)
    private readonly settingsRepo: Repository<FollowUpSettings>,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  // Effectively a singleton row — get-or-create so the app works even if the
  // migration's seed row is somehow missing (e.g. a hand-rolled test DB).
  async getSettings(): Promise<FollowUpSettings> {
    const existing = await this.settingsRepo.find({ take: 1 });
    if (existing[0]) return existing[0];
    return this.settingsRepo.save(this.settingsRepo.create({}));
  }

  async updateSettings(
    dto: UpdateFollowUpSettingsDto,
    actorUserId: string,
  ): Promise<FollowUpSettings> {
    const settings = await this.getSettings();
    settings.delayMinutes = dto.delayMinutes;
    settings.updatedByUserId = actorUserId;
    return this.settingsRepo.save(settings);
  }

  // The delay is now configurable down to the minute, so the poll itself
  // has to run at least that often — hourly polling would silently turn a
  // "5 minutes" setting into "up to ~65 minutes."
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue(): Promise<void> {
    const settings = await this.getSettings().catch((err: unknown) => {
      this.logger.error('Failed to load follow-up settings', err);
      return null;
    });
    if (!settings) return;

    const cutoff = new Date(Date.now() - settings.delayMinutes * MINUTE_MS);

    let due: Sponsor[];
    try {
      due = await this.sponsorRepo.find({
        where: {
          followUpSentAt: IsNull(),
          createdAt: LessThanOrEqual(cutoff),
        },
        // The follow-up queue only needs sponsor contact details. Avoid loading
        // the eager child relation so this scheduled job remains independent
        // of child profile schema changes and performs a smaller query.
        loadEagerRelations: false,
      });
    } catch (err) {
      this.logger.error(
        'Failed to query sponsors for follow-up (DB connection issue?)',
        err,
      );
      return;
    }

    if (due.length === 0) return;

    for (const sponsor of due) {
      try {
        await this.sendFollowUpNow(sponsor);
      } catch (err) {
        this.logger.error(`Failed to send follow-up to ${sponsor.email}`, err);
      }
    }
  }

  // Shared by the cron loop above and the manual "resend" path (a
  // sponsorship-manager retrying a failed/never-sent follow-up from the
  // sponsor detail UI) so both go through identical provisioning + send +
  // stamping logic rather than duplicating it.
  async sendFollowUpNow(sponsor: Sponsor): Promise<void> {
    const credentials = await this.provisionPortalAccount(sponsor);
    await this.mailService.send({
      triggerKey: 'sponsor.profile-reminder',
      to: sponsor.email,
      data: {
        name: sponsor.name,
        year: String(new Date().getFullYear()),
        ...credentials,
      },
    });
    sponsor.followUpSentAt = new Date();
    await this.sponsorRepo.save(sponsor);
    this.logger.log(`Sent follow-up email to ${sponsor.email}`);
  }

  // Provisions the sponsor's portal login at follow-up time so the reminder
  // can carry real credentials. If an account already exists (e.g. an admin
  // provisioned one manually before the cron got to this sponsor), no new
  // password is generated — the sponsor keeps whatever they already have,
  // and the email links them to login without repeating credentials.
  //
  // temporaryPassword is always included, as '' when there's nothing to
  // show — never omitted. mergeContext() fills any *omitted* declared field
  // with its dataSchema sample value, so leaving this out on the
  // already-provisioned path would render the fake example password
  // ('Kx7...redacted') as if it were real.
  private async provisionPortalAccount(
    sponsor: Sponsor,
  ): Promise<{ email: string; loginUrl: string; temporaryPassword: string }> {
    const frontendUrl = process.env.MIS_FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login?next=/portal/preferences`;

    try {
      const { temporaryPassword } =
        await this.usersService.createSponsorAccount({
          sponsorId: sponsor.id,
          skipEmail: true,
        });
      return { email: sponsor.email, loginUrl, temporaryPassword };
    } catch (err) {
      if (err instanceof ConflictException) {
        return { email: sponsor.email, loginUrl, temporaryPassword: '' };
      }
      throw err;
    }
  }
}
