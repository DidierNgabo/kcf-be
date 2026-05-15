import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { MailtrapClient } from 'mailtrap';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Sponsor } from './entities/sponsor.entity';

const SENDER = {
  name: 'Kwizera Charity Foundation',
  email: 'hello@vnbcoffee.com',
};

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);
  private readonly client = new MailtrapClient({
    token: process.env.MAILTRAP_TOKEN!,
  });

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
  ) {}

  @Cron('*/10 * * * *')
  async processQueue(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const due = await this.sponsorRepo.find({
      where: {
        followUpSentAt: IsNull(),
        createdAt: LessThanOrEqual(cutoff),
      },
    });

    if (due.length === 0) return;

    const heroImage = fs.readFileSync(
      path.join(__dirname, 'templates', 'kids.jpeg'),
    );

    for (const sponsor of due) {
      try {
        await this.client.send({
          from: SENDER,
          to: [{ email: sponsor.email }],
          subject: "Let's find your little bestie – Complete your profile",
          html: this.renderTemplate('sponsorship_profile', {
            name: sponsor.name,
            year: String(new Date().getFullYear()),
          }),
          attachments: [
            {
              filename: 'kids.jpeg',
              type: 'image/jpeg',
              content: heroImage,
              disposition: 'inline',
              content_id: 'profile-hero',
            },
          ],
        });
        sponsor.followUpSentAt = new Date();
        await this.sponsorRepo.save(sponsor);
        this.logger.log(`Sent follow-up email to ${sponsor.email}`);
      } catch (err) {
        this.logger.error(`Failed to send follow-up to ${sponsor.email}`, err);
      }
    }
  }

  private renderTemplate(name: string, context: Record<string, string>): string {
    const file = fs.readFileSync(
      path.join(__dirname, 'templates', `${name}.hbs`),
      'utf8',
    );
    return handlebars.compile(file)(context);
  }
}
