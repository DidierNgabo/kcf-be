import * as Handlebars from 'handlebars';

// Explicit allowlist of custom helpers on top of Handlebars' built-ins
// (if/unless/each/with/lookup/log, always permitted regardless of
// knownHelpersOnly). Keep this list and ALLOWED_HELPER_NAMES in sync.
export const ALLOWED_HELPER_NAMES = [
  'formatDate',
  'formatNumber',
  'formatCurrency',
  'uppercase',
  'lowercase',
  'pluralize',
  'default',
] as const;

function toDisplayString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

export function registerHelpers(instance: typeof Handlebars): void {
  instance.registerHelper('formatDate', (value: unknown) => {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  instance.registerHelper('formatNumber', (value: unknown) => {
    const num = Number(value);
    return Number.isNaN(num) ? '' : num.toLocaleString('en-US');
  });

  instance.registerHelper(
    'formatCurrency',
    (value: unknown, currency: unknown) => {
      const num = Number(value);
      if (Number.isNaN(num)) return '';
      const code = typeof currency === 'string' ? currency : 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
      }).format(num);
    },
  );

  instance.registerHelper('uppercase', (value: unknown) =>
    toDisplayString(value).toUpperCase(),
  );

  instance.registerHelper('lowercase', (value: unknown) =>
    toDisplayString(value).toLowerCase(),
  );

  instance.registerHelper(
    'pluralize',
    (count: unknown, singular: unknown, plural?: unknown) => {
      const n = Number(count);
      const singularText = toDisplayString(singular);
      if (n === 1) return singularText;
      return typeof plural === 'string' ? plural : `${singularText}s`;
    },
  );

  instance.registerHelper('default', (value: unknown, fallback: unknown) =>
    value === undefined || value === null || value === '' ? fallback : value,
  );
}
