export interface TriggerDataField {
  // Dot-path as referenced in Handlebars, e.g. 'user.firstName'.
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  description?: string;
  example: unknown;
  // Sensitive values (tokens, temporary passwords, reset links) are redacted
  // before the send payload is persisted to email_log.
  sensitive?: boolean;
}

export interface TriggerStaticAttachment {
  filename: string;
  path: string;
  mimeType: string;
  contentId: string;
}

export interface TriggerDefaults {
  subject: string;
  bodyHtml: string;
}

export interface TriggerMetadata {
  key: string;
  name: string;
  description: string;
  dataSchema: TriggerDataField[];
  defaults: TriggerDefaults;
  staticAttachments?: TriggerStaticAttachment[];
  // Marks the reserved pseudo-trigger behind ad-hoc broadcast/newsletter
  // templates, so the frontend can exclude it from the regular
  // one-template-per-trigger creation flow (broadcasts have their own).
  isBroadcast?: boolean;
}
