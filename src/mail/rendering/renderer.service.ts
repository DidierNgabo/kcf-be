import { Injectable } from '@nestjs/common';
import { convert } from 'html-to-text';
import { compileMailTemplate } from './handlebars.config';
import { sanitizeRenderedEmail } from './sanitizer';

export interface RenderInput {
  subjectTemplate: string;
  bodyTemplate: string;
  layoutHtml: string;
  context: Record<string, unknown>;
}

export interface RenderResult {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class RendererService {
  render(input: RenderInput): RenderResult {
    if (!input.layoutHtml.includes('{{{body}}}')) {
      throw new Error("Layout is missing the required '{{{body}}}' slot");
    }

    const subject = compileMailTemplate(input.subjectTemplate)(input.context);
    const renderedBody = compileMailTemplate(input.bodyTemplate)(input.context);
    // The layout is compiled through the same Handlebars instance (not a
    // plain string replace) so it can reference context variables of its
    // own — e.g. a per-recipient unsubscribe link in a broadcast footer —
    // not just splice in the body. Safe to do: the layout is trusted,
    // code-seeded content (no staff editing UI), so this doesn't create a
    // new place for staff-authored `{{{triple-stash}}}` to sneak through —
    // that's still enforced by validateTemplateSource() on subject/bodyHtml.
    const wrapped = compileMailTemplate(input.layoutHtml)({
      ...input.context,
      body: renderedBody,
    });
    const html = sanitizeRenderedEmail(wrapped);
    const text = convert(html, { wordwrap: 130 });
    return { subject, html, text };
  }
}
