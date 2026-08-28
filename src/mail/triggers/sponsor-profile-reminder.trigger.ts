import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'sponsor-profile-reminder.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'sponsor.profile-reminder',
  name: 'Sponsorship profile invitation',
  description:
    'Sent immediately after a prospective sponsor registers interest so they can complete their profile.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "Sponsor's name",
      example: 'Aline Uwase',
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
    {
      name: 'email',
      type: 'string',
      description: "Sponsor's portal login email",
      example: 'aline@example.org',
    },
    {
      name: 'temporaryPassword',
      type: 'string',
      description:
        'One-time temporary password for the sponsor portal. Only present the first time — absent if the sponsor already has an account.',
      example: 'Kx7...redacted',
      sensitive: true,
    },
    {
      name: 'loginUrl',
      type: 'string',
      description:
        'Link to log in and complete the sponsorship preferences page',
      example: 'https://mis.kcf.org/login?next=/portal/preferences',
      sensitive: true,
    },
  ],
  defaults: {
    subject: "Let's find your little bestie – Complete your profile",
    bodyHtml,
  },
  staticAttachments: [
    {
      filename: 'kids.jpeg',
      path: path.join(__dirname, '..', 'assets', 'kids.jpeg'),
      mimeType: 'image/jpeg',
      contentId: 'profile-hero',
    },
  ],
})
export class SponsorProfileReminderTrigger {}
