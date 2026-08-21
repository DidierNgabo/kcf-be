import * as fs from 'fs';
import * as path from 'path';
import { TriggerStaticAttachment } from '../registry/mail-trigger.types';

export const SHARED_EMAIL_LAYOUT_HTML = fs.readFileSync(
  path.join(__dirname, 'defaults', 'shared-layout.hbs'),
  'utf8',
);

function iconAttachment(name: string): TriggerStaticAttachment {
  return {
    filename: `${name}.png`,
    path: path.join(__dirname, '..', 'assets', `${name}.png`),
    mimeType: 'image/png',
    contentId: name,
  };
}

export const SHARED_EMAIL_ATTACHMENTS: TriggerStaticAttachment[] = [
  {
    filename: 'kcf-logo.png',
    path: path.join(__dirname, '..', 'assets', 'kcf-logo.png'),
    mimeType: 'image/png',
    contentId: 'kcf-logo',
  },
  iconAttachment('icon-website'),
  iconAttachment('icon-instagram'),
  iconAttachment('icon-facebook'),
  iconAttachment('icon-email'),
];
