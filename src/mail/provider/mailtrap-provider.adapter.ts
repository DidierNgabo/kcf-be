import { Injectable } from '@nestjs/common';
import { MailtrapClient } from 'mailtrap';
import * as fs from 'fs';
import { DEFAULT_SENDER } from '../mail.constants';
import { TriggerStaticAttachment } from '../registry/mail-trigger.types';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: TriggerStaticAttachment[];
}

@Injectable()
export class MailtrapProviderAdapter {
  private readonly client = new MailtrapClient({
    token: process.env.MAILTRAP_TOKEN!,
  });

  async send(input: SendEmailInput): Promise<string | null> {
    const response = await this.client.send({
      from: DEFAULT_SENDER,
      to: [{ email: input.to }],
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        type: attachment.mimeType,
        content: fs.readFileSync(attachment.path),
        disposition: 'inline' as const,
        content_id: attachment.contentId,
      })),
    });

    return response.success ? (response.message_ids?.[0] ?? null) : null;
  }
}
