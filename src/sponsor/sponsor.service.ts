import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailtrapClient } from 'mailtrap';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { CreateSponsorDto } from './dto/create-sponsor.dto';

const SENDER = { name: 'Kwizera Charity Foundation', email: 'hello@vnbcoffee.com' };

@Injectable()
export class SponsorService {
  private readonly client = new MailtrapClient({ token: process.env.MAILTRAP_TOKEN! });

  private renderTemplate(name: string, context: Record<string, string>): string {
    const file = fs.readFileSync(path.join(__dirname, 'templates', `${name}.hbs`), 'utf8');
    return handlebars.compile(file)(context);
  }

  async submit(dto: CreateSponsorDto): Promise<void> {
    const { name, email, phone, message } = dto;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
  }
}
