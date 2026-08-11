import { resolveCssVariables } from './css-variables';

describe('resolveCssVariables', () => {
  it('resolves a var() usage inside a <style> rule', () => {
    const html = `<style>:root{--blue:#3859A6;}.footer{background:var(--blue);}</style>`;
    expect(resolveCssVariables(html)).toBe(
      `<style>:root{--blue:#3859A6;}.footer{background:#3859A6;}</style>`,
    );
  });

  it('resolves a var() usage inside an inline style attribute', () => {
    const html =
      `<style>:root{--blue:#3859A6;}</style>` +
      `<div style="background: var(--blue);">hi</div>`;
    expect(resolveCssVariables(html)).toBe(
      `<style>:root{--blue:#3859A6;}</style>` +
        `<div style="background: #3859A6;">hi</div>`,
    );
  });

  it('resolves multiple distinct custom properties consistently across elements', () => {
    const html =
      `<style>:root{--blue:#3859A6;--ink:#364153;}` +
      `.header{background:var(--blue);color:var(--ink);}` +
      `.footer{background:var(--blue);color:var(--ink);}</style>`;
    const result = resolveCssVariables(html);
    expect(result).toContain('.header{background:#3859A6;color:#364153;}');
    expect(result).toContain('.footer{background:#3859A6;color:#364153;}');
  });

  it('falls back to the declared fallback when the custom property is undeclared', () => {
    const html = `<style>.box{background:var(--missing, #ffffff);}</style>`;
    expect(resolveCssVariables(html)).toBe(
      `<style>.box{background:#ffffff;}</style>`,
    );
  });

  it('leaves an undeclared var() with no fallback untouched rather than dropping it', () => {
    const html = `<style>.box{background:var(--missing);}</style>`;
    expect(resolveCssVariables(html)).toBe(html);
  });

  it('passes HTML with no custom properties through unchanged', () => {
    const html = '<div style="background:#3859A6">hi</div>';
    expect(resolveCssVariables(html)).toBe(html);
  });
});
