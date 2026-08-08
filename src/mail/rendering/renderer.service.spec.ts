// See sanitizer.spec.ts for why these are mocked instead of imported at the
// top of the module under test — juice/sanitize-html ship ESM-only.
const sanitizeHtmlMock = jest.fn((html: string) => html);
jest.mock('sanitize-html', () => sanitizeHtmlMock);
jest.mock('juice', () => ({
  __esModule: true,
  default: (html: string) => html,
}));

import { RendererService } from './renderer.service';

describe('RendererService', () => {
  const renderer = new RendererService();

  it('produces identical output through the passthrough layout as before the layout-compile change', () => {
    const result = renderer.render({
      subjectTemplate: 'Hi {{name}}',
      bodyTemplate: '<p>Hello {{name}}</p>',
      layoutHtml: '{{{body}}}',
      context: { name: 'Aline' },
    });

    expect(result.subject).toBe('Hi Aline');
    expect(result.html).toBe('<p>Hello Aline</p>');
  });

  it('resolves a context variable referenced only in the layout, not the body (e.g. a broadcast unsubscribe link)', () => {
    // Triple-stash, matching the real broadcast layout: the layout is
    // trusted/code-seeded, and a plain {{}} would HTML-entity-escape the
    // '=' in the query string (harmless once browser-parsed, but needlessly
    // confusing) — see the AddBroadcastAndUnsubscribe migration.
    const result = renderer.render({
      subjectTemplate: 'Update',
      bodyTemplate: '<p>News</p>',
      layoutHtml: '{{{body}}}<a href="{{{unsubscribeUrl}}}">Unsubscribe</a>',
      context: { unsubscribeUrl: 'https://mis.kcf.org/unsubscribe?token=abc' },
    });

    expect(result.html).toBe(
      '<p>News</p><a href="https://mis.kcf.org/unsubscribe?token=abc">Unsubscribe</a>',
    );
  });

  it('throws if a layout is missing the {{{body}}} slot', () => {
    expect(() =>
      renderer.render({
        subjectTemplate: 'Subject',
        bodyTemplate: '<p>Body</p>',
        layoutHtml: '<p>No slot here</p>',
        context: {},
      }),
    ).toThrow("Layout is missing the required '{{{body}}}' slot");
  });
});
