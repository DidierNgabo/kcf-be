import { Injectable } from '@nestjs/common';
import { MailTrigger } from '../registry/mail-trigger.decorator';
import { BROADCAST_TRIGGER_KEY } from '../mail.constants';

@Injectable()
@MailTrigger({
  key: BROADCAST_TRIGGER_KEY,
  name: 'Broadcast / Newsletter',
  description:
    'A one-off custom update written entirely by staff and sent to a chosen group of sponsors — not tied to any system event. Create one from the "New broadcast" button.',
  isBroadcast: true,
  dataSchema: [
    {
      name: 'sponsor.name',
      type: 'string',
      description: "The sponsor's name",
      example: 'Jean Bosco',
    },
    {
      name: 'sponsor.child.name',
      type: 'string',
      description:
        "Name of the child this sponsor is matched to. Blank for unmatched sponsors — only use this if you're sending to the 'Matched sponsors' audience.",
      example: 'Alice',
    },
    {
      name: 'unsubscribeUrl',
      type: 'string',
      description:
        'Link that lets the recipient opt out of future updates. Already included automatically in the broadcast footer — you do not need to paste this yourself.',
      example: 'https://mis.kcf.org/unsubscribe?token=sample',
      sensitive: true,
    },
  ],
  defaults: {
    subject: 'An update from Kwizera Charity Foundation',
    bodyHtml: '<p>Hi {{sponsor.name}},</p>\n<p>Write your update here…</p>',
  },
})
export class ManualBroadcastTrigger {}
