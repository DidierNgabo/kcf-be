import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'sponsor-inquiry-received.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'sponsor.inquiry-received',
  name: 'Sponsorship inquiry received (internal)',
  description:
    'Internal notification sent to the KCF team when a new sponsorship inquiry is submitted.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "Inquirer's name",
      example: 'Aline Uwase',
    },
    {
      name: 'email',
      type: 'string',
      description: "Inquirer's email",
      example: 'aline@example.org',
    },
    {
      name: 'phone',
      type: 'string',
      description: 'Phone number, or "Not provided"',
      example: '+250 700 000 000',
    },
    {
      name: 'message',
      type: 'string',
      description: 'Free-text message, or "None"',
      example: 'I would love to sponsor a child.',
    },
    {
      name: 'date',
      type: 'string',
      description: 'Human-readable submission date',
      example: 'January 15, 2026',
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
  ],
  defaults: {
    subject: 'New sponsorship inquiry from {{name}}',
    bodyHtml,
  },
})
export class SponsorInquiryReceivedTrigger {}
