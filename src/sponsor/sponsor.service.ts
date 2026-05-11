import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MailtrapClient } from 'mailtrap';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { children } from '../data/children';

const SENDER = {
  name: 'Kwizera Charity Foundation',
  email: 'hello@vnbcoffee.com',
};

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name);
  private readonly client = new MailtrapClient({
    token: process.env.MAILTRAP_TOKEN!,
  });

  constructor(private readonly mailtrapContacts: MailtrapContactsService) {}

  private renderTemplate(
    name: string,
    context: Record<string, string>,
  ): string {
    const file = fs.readFileSync(
      path.join(__dirname, 'templates', `${name}.hbs`),
      'utf8',
    );
    return handlebars.compile(file)(context);
  }

  async submit(dto: CreateSponsorDto): Promise<void> {
    const { name, email, phone, message } = dto;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const year = String(now.getFullYear());

    try {
      await this.client.send({
        from: SENDER,
        to: [{ email }],
        subject: 'Thank you for your interest in sponsoring a child!',
        html: this.renderTemplate('acknowledgment', { name, year }),
      });

      await this.client.send({
        from: SENDER,
        to: [{ email: process.env.NOTIFICATION_EMAIL! }],
        subject: `New sponsorship inquiry from ${name}`,
        html: this.renderTemplate('notification', {
          name,
          email,
          phone: phone || 'Not provided',
          message: message || 'None',
          date,
          year,
        }),
      });
    } catch {
      throw new InternalServerErrorException('Failed to send email');
    }

    try {
      await this.mailtrapContacts.upsertContact(dto);
    } catch (err) {
      this.logger.error('Failed to save contact to Mailtrap', err);
    }
  }

  async match(dto: MatchSponsorDto): Promise<void> {
    const child = children.find((c) => c.id === dto.childId);
    if (!child) {
      throw new NotFoundException(`Child with id "${dto.childId}" not found`);
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const year = String(new Date().getFullYear());

    try {
      await this.client.send({
        from: SENDER,
        to: [{ email: dto.sponsorEmail }],
        subject: `You've been matched with ${child.name}! – KCF`,
        html: this.renderTemplate('match', {
          sponsorName: dto.sponsorName,
          childName: child.name,
          childAge: String(child.age),
          childBio: child.bio,
          childImageUrl: `${frontendUrl}${child.imageUrl}`,
          year,
        }),
      });
    } catch {
      throw new InternalServerErrorException('Failed to send match email');
    }
  }
}
