// juice ships ESM-only ({ __esModule: true, default: fn }); sanitize-html is
// plain CJS `export =` (the function itself, no .default). sanitizer.ts
// lazily requires both — these mocks mirror each package's *real* export
// shape exactly, so an incorrect `.default` unwrap on either one (a real bug
// caught via manual testing once) fails loudly here instead of being masked.
const sanitizeHtmlMock = jest.fn((html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, ''),
);
jest.mock('sanitize-html', () => sanitizeHtmlMock);
jest.mock('juice', () => ({
  __esModule: true,
  default: (html: string) => html,
}));

import { sanitizeRenderedEmail } from './sanitizer';

describe('sanitizeRenderedEmail', () => {
  it('calls sanitize-html as a plain function (not .default) and returns its output', () => {
    const out = sanitizeRenderedEmail('<p>hi</p><script>alert(1)</script>');
    expect(sanitizeHtmlMock).toHaveBeenCalled();
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>hi</p>');
  });

  it('passes juice output (the CSS-inlining step) through as the sanitizer input', () => {
    sanitizeHtmlMock.mockClear();
    sanitizeRenderedEmail('<div style="color:red">hi</div>');
    expect(sanitizeHtmlMock).toHaveBeenCalledWith(
      '<div style="color:red">hi</div>',
      expect.any(Object),
    );
  });
});
