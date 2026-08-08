import * as Handlebars from 'handlebars';
import { ALLOWED_HELPER_NAMES, registerHelpers } from './helpers';

// An isolated instance (not the global Handlebars singleton the legacy
// services import) so registering/allowlisting helpers here can't leak into
// or be affected by anything else in the process.
export const mailHandlebars = Handlebars.create();
registerHelpers(mailHandlebars);

const KNOWN_HELPERS: Record<string, boolean> = Object.fromEntries(
  ALLOWED_HELPER_NAMES.map((name) => [name, true]),
);

export function compileMailTemplate(
  source: string,
): HandlebarsTemplateDelegate {
  return mailHandlebars.compile(source, {
    knownHelpers: KNOWN_HELPERS,
    knownHelpersOnly: true,
    strict: false,
  });
}
