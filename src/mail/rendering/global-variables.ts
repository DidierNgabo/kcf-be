export const GLOBAL_VARIABLE_NAMES = [
  'app.name',
  'currentYear',
  'recipient.email',
] as const;

export function buildGlobalVariables(
  recipientEmail: string,
): Record<string, unknown> {
  return {
    app: { name: 'Kwizera Charity Foundation' },
    currentYear: String(new Date().getFullYear()),
    recipient: { email: recipientEmail },
  };
}
