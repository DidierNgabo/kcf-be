import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'sponsor-acknowledgment.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'sponsor.acknowledged',
  name: 'Sponsorship acknowledgment',
  description:
    'Sent once after a prospective sponsor first completes their sponsorship profile.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "Prospective sponsor's name",
      example: 'Aline Uwase',
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
  ],
  defaults: {
    subject: 'Thank you for your interest in sponsoring a child!',
    bodyHtml,
  },
  staticAttachments: [
    {
      filename: 'kids.jpeg',
      path: path.join(__dirname, '..', 'assets', 'kids.jpeg'),
      mimeType: 'image/jpeg',
      contentId: 'kids-hero',
    },
  ],
})
export class SponsorAcknowledgmentTrigger {}
