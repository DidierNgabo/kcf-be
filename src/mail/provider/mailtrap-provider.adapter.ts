import { Injectable } from '@nestjs/common';
import { MailtrapClient } from 'mailtrap';
import * as fs from 'fs';
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
  private readonly client: MailtrapClient;
  private readonly sender: { name: string; email: string };

  constructor() {
    const token = process.env.MAILTRAP_TOKEN;
    const senderName = process.env.MAIL_FROM_NAME;
    const senderEmail = process.env.MAIL_FROM_EMAIL;

    if (!token) throw new Error('MAILTRAP_TOKEN is required');
    if (!senderName) throw new Error('MAIL_FROM_NAME is required');
    if (!senderEmail) throw new Error('MAIL_FROM_EMAIL is required');

    this.client = new MailtrapClient({ token });
    this.sender = { name: senderName, email: senderEmail };
  }

  async send(input: SendEmailInput): Promise<string | null> {
    const response = await this.client.send({
      from: this.sender,
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
