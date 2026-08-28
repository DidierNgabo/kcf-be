import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sponsor } from './entities/sponsor.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

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
        const temporaryPassword = sponsor.followUpSentAt
          ? ''
          : await this.usersService.rotateUnsentSponsorInvitationPassword(
              sponsor.id,
            );
        return { email: sponsor.email, loginUrl, temporaryPassword };
      }
      throw err;
    }
  }
}
