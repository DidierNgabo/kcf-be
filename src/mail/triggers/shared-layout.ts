import * as fs from 'fs';
import * as path from 'path';
import { TriggerStaticAttachment } from '../registry/mail-trigger.types';

export const SHARED_EMAIL_LAYOUT_HTML = fs.readFileSync(
  path.join(__dirname, 'defaults', 'shared-layout.hbs'),
  'utf8',
);

export const SHARED_EMAIL_ATTACHMENTS: TriggerStaticAttachment[] = [
  {
    filename: 'kcf-logo.png',
    path: path.join(__dirname, '..', 'assets', 'kcf-logo.png'),
    mimeType: 'image/png',
    contentId: 'kcf-logo',
  },
];
