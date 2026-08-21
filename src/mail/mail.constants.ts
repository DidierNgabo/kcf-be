// Single source of truth for which locale values a template can be created
// with. Currently just one — add another entry here (and the mirrored list
// in kcf-mis) when real multi-language wording is needed.
export const SUPPORTED_LOCALES = [
  { value: 'default', label: 'Default (English)' },
] as const;

export const SUPPORTED_LOCALE_VALUES = SUPPORTED_LOCALES.map((l) => l.value);

// Reserved triggerKey shared by every ad-hoc broadcast/newsletter template.
// Unlike the coded triggers, many email_template rows may share this key —
// see the partial unique index in the mail schema migration.
export const BROADCAST_TRIGGER_KEY = 'manual.broadcast';
