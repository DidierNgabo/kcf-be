export const MAIL_QUEUE_NAME = 'mail-send';

export interface MailJobData {
  emailLogId: string;
  triggerKey: string;
  to: string;
  data: Record<string, unknown>;
  locale: string;
  // Set only for broadcast sends, where many campaigns share one triggerKey
  // and the ordinary triggerKey+locale resolution can't disambiguate between
  // them — points the processor at the exact template to resolve instead.
  templateId?: string;
}
