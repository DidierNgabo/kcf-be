import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MailTrigger } from '../registry/mail-trigger.decorator';

const bodyHtml = fs.readFileSync(
  path.join(__dirname, 'defaults', 'user-password-reset.hbs'),
  'utf8',
);

@Injectable()
@MailTrigger({
  key: 'user.password-reset',
  name: 'Password reset',
  description: 'Sent when a user requests a password reset.',
  dataSchema: [
    {
      name: 'name',
      type: 'string',
      description: "User's name",
      example: 'Jean Bosco',
    },
    {
      name: 'resetUrl',
      type: 'string',
      description: 'One-time password reset link',
      example: 'https://mis.kcf.org/reset-password?token=abc123',
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
    subject: 'Reset your KCF password',
    bodyHtml,
  },
})
export class UserPasswordResetTrigger {}
