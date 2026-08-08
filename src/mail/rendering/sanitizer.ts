import type SanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'html',
  'head',
  'meta',
  'title',
  'style',
  'body',
  'table',
  'tbody',
  'thead',
  'tr',
  'td',
  'th',
  'div',
  'span',
  'p',
  'a',
  'img',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'blockquote',
];

const ALLOWED_ATTRIBUTES: SanitizeHtml.IOptions['allowedAttributes'] = {
  '*': [
    'style',
    'class',
    'align',
    'width',
    'height',
    'id',
    'lang',
    'charset',
    'name',
    'content',
  ],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  table: ['cellpadding', 'cellspacing', 'border'],
  td: ['colspan', 'rowspan', 'valign'],
  th: ['colspan', 'rowspan', 'valign'],
  meta: ['charset', 'name', 'content'],
};

/**
 * Inlines CSS (juice needs the <style> blocks present, so it must run before
 * sanitize-html strips anything) then sanitizes the result — script tags,
 * event handlers and javascript: URLs are stripped, everything else in the
 * email-safe allowlist survives, including the style/class attributes juice
 * just wrote.
 *
 * juice and sanitize-html (and several of their own dependencies, e.g.
 * postcss-nesting, sanitize-html's bundled htmlparser2) ship ESM-only, which
 * this repo's ts-jest/CJS test setup can't load. Requiring them lazily here
 * — instead of a module-top `import` — means simply wiring MailProcessor
 * into the DI graph (as every test that boots AppModule does, including
 * unrelated ones like auth.e2e-spec.ts) doesn't eagerly pull them in; only
 * code paths that actually render an email do.
 */
export function sanitizeRenderedEmail(html: string): string {
  // juice is ESM-transpiled ({ __esModule: true, default: fn }); sanitize-html
  // is a plain CJS `export =` (the function itself) — they unwrap differently.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const juice = (require('juice') as { default: (html: string) => string })
    .default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sanitizeHtml = require('sanitize-html') as typeof SanitizeHtml;

  const juiced = juice(html);
  return sanitizeHtml(juiced, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'cid'],
    // 'style' is flagged by sanitize-html as XSS-vulnerable in a browser
    // context (old-IE `expression()`, `@import` exfiltration). This output is
    // only ever sent as email or rendered in our own scriptless preview
    // iframe, and keeping <style> is required for the @media queries juice
    // can't inline — script tags/handlers are still fully stripped above.
    allowVulnerableTags: true,
  });
}
