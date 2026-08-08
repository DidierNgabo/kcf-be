import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'user-account-provisioned.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'user.account-provisioned',
  name: 'Sponsor portal account provisioned',
  description:
    'Sent when a sponsor portal login account is created for an existing sponsor.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "Sponsor's name",
      example: 'Aline Uwase',
    },
    {
      name: 'email',
      type: 'string',
      description: "Sponsor's login email",
      example: 'aline@example.org',
    },
    {
      name: 'temporaryPassword',
      type: 'string',
      description: 'One-time temporary password',
      example: 'Kx7...redacted',
      sensitive: true,
    },
    {
      name: 'loginUrl',
      type: 'string',
      description: 'Link to the sponsor portal login page',
      example: 'https://mis.kcf.org/login',
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
  ],
  defaults: {
    subject: 'Your KCF sponsor portal account',
    bodyHtml,
  },
})
export class UserAccountProvisionedTrigger {}
