const CUSTOM_PROPERTY_DECLARATION = /--([a-zA-Z0-9-_]+)\s*:\s*([^;{}]+);/g;
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const VAR_USAGE = /var\(\s*--([a-zA-Z0-9-_]+)\s*(?:,\s*([^)]+))?\)/g;

/**
 * Resolves `var(--name)` / `var(--name, fallback)` to literal values, using
 * `--name: value;` declarations collected from every `<style>` block in the
 * document (not just `:root` — authors may scope tokens elsewhere).
 *
 * juice() has its own built-in CSS-variable resolver (`resolveCSSVariables`),
 * but it's a hand-rolled, non-browser reimplementation of the CSS cascade
 * that walks the DOM ancestor chain and gives any pre-existing inline
 * `style` attribute artificial top specificity — it can resolve the same
 * `var(--x)` differently on different elements. Resolving variables
 * ourselves, in one deterministic pass, before juice ever sees the HTML,
 * removes that class of bug entirely (see sanitizeRenderedEmail, which
 * disables juice's own resolver once this has already run).
 *
 * Single-pass only: a declaration whose own value references another
 * `var(...)` is not chased further. Nothing in this codebase's templates
 * chains custom properties, and keeping this to one pass keeps the
 * resolution trivially easy to reason about.
 */
export function resolveCssVariables(html: string): string {
  // A cheap skip for the common case (no var() usage at all) — NOT based on
  // whether any --name declaration was found, since a var(--x, fallback)
  // usage still needs its fallback applied even when --x is never declared.
  if (!html.includes('var(')) return html;

  const declarations = new Map<string, string>();
  for (const styleMatch of html.matchAll(STYLE_BLOCK)) {
    for (const declMatch of styleMatch[1].matchAll(
      CUSTOM_PROPERTY_DECLARATION,
    )) {
      declarations.set(declMatch[1], declMatch[2].trim());
    }
  }

  return html.replace(
    VAR_USAGE,
    (fullMatch, name: string, fallback: string | undefined) => {
      const resolved = declarations.get(name);
      if (resolved !== undefined) return resolved;
      if (fallback !== undefined) return fallback.trim();
      return fullMatch;
    },
  );
}
