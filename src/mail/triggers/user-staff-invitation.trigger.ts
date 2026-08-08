import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'user-staff-invitation.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'user.staff-invitation',
  name: 'Staff account invitation',
  description:
    'Sent when an admin creates a new staff account on the KCF Management System.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "Invitee's name",
      example: 'Jean Bosco',
    },
    {
      name: 'email',
      type: 'string',
      description: "Invitee's login email",
      example: 'jean@kcf.org',
    },
    {
      name: 'temporaryPassword',
      type: 'string',
      description: 'One-time temporary password',
      example: 'Kx7...redacted',
      sensitive: true,
    },
    {
      name: 'year',
      type: 'string',
      description: 'Current year, for the footer',
      example: '2026',
    },
  ],
  defaults: {
    subject: 'Your KCF account is ready',
    bodyHtml,
  },
})
export class UserStaffInvitationTrigger {}
