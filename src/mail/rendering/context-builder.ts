import { TriggerDataField } from '../registry/mail-trigger.types';
import { buildGlobalVariables } from './global-variables';

function setDeepPath(
  target: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const parts = dotPath.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function buildSampleContext(
  dataSchema: TriggerDataField[],
): Record<string, unknown> {
  const context: Record<string, unknown> =
    buildGlobalVariables('sample@example.org');
  for (const field of dataSchema) {
    setDeepPath(context, field.name, field.example);
  }
  return context;
}

// Deep-merges caller data + global variables over a base built from sample
// examples, so a real send always has every declared field populated even if
// the caller omitted an optional one.
export function mergeContext(
  dataSchema: TriggerDataField[],
  data: Record<string, unknown>,
  recipientEmail: string,
): Record<string, unknown> {
  const context = buildSampleContext(dataSchema);
  return deepMerge(context, {
    ...data,
    ...buildGlobalVariables(recipientEmail),
  });
}

// Used by preview/test-send, where the caller supplies an editable
// sample-data JSON object rather than a real domain payload.
export function mergePreviewContext(
  dataSchema: TriggerDataField[],
  sampleData: Record<string, unknown> | undefined,
  recipientEmail: string,
): Record<string, unknown> {
  const base = buildSampleContext(dataSchema);
  const withSampleData = deepMerge(base, sampleData ?? {});
  return deepMerge(withSampleData, buildGlobalVariables(recipientEmail));
}

function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = result[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof existing === 'object' &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Redacts trigger fields marked `sensitive: true` before a context/payload is
// persisted (e.g. into email_log), so a leaked log row can't be a working
// credential or account-takeover link.
export function redactSensitiveFields(
  dataSchema: TriggerDataField[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = structuredClone(data);
  for (const field of dataSchema) {
    if (!field.sensitive) continue;
    const parts = field.name.split('.');
    let cursor: Record<string, unknown> = redacted;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = cursor[parts[i]];
      if (typeof next !== 'object' || next === null) {
        cursor = {};
        break;
      }
      cursor = next as Record<string, unknown>;
    }
    const lastKey = parts[parts.length - 1];
    if (lastKey in cursor) cursor[lastKey] = '[redacted]';
  }
  return redacted;
}
