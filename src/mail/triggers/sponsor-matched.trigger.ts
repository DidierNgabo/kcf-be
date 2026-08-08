import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'sponsor-matched.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'sponsor.matched',
  name: 'Sponsor matched with a child',
  description: 'Sent to a sponsor when they are matched with a child.',
  dataSchema: [
    {
      name: 'sponsorName',
      type: 'string',
      description: "Sponsor's name",
      example: 'Aline Uwase',
    },
    {
      name: 'childName',
      type: 'string',
      description: "Child's name",
      example: 'Divine',
    },
    {
      name: 'childAge',
      type: 'string',
      description: "Child's age",
      example: '9',
    },
    {
      name: 'childSubject',
      type: 'string',
      description: 'Favourite school subject',
      example: 'Mathematics',
    },
    {
      name: 'childDream',
      type: 'string',
      description: 'Career dream',
      example: 'a doctor',
    },
    {
      name: 'childHobby',
      type: 'string',
      description: 'Favourite hobby',
      example: 'football',
    },
    {
      name: 'childPersonality',
      type: 'string',
      description: 'Personality description',
      example: 'cheerful and curious',
    },
    {
      name: 'childFamily',
      type: 'string',
      description: 'Family situation',
      example: 'their grandmother',
    },
    {
      name: 'childLocation',
      type: 'string',
      description: 'Neighbourhood/location',
      example: 'Nyamirambo',
    },
    {
      name: 'childUniqueQuality',
      type: 'string',
      description: 'What makes the child unique',
      example: 'their infectious laugh',
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
  ],
  defaults: {
    subject: "You've been matched with {{childName}}! – KCF",
    bodyHtml,
  },
  staticAttachments: [
    {
      filename: 'kids.jpeg',
      path: path.join(__dirname, '..', 'assets', 'kids.jpeg'),
      mimeType: 'image/jpeg',
      contentId: 'match-child',
    },
  ],
})
export class SponsorMatchedTrigger {}
