import { describe, it, expect } from 'vitest';
import { inlineMarkdownToHtml, markdownToHtml } from '../src/lib/richtext';

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer" class="action-inline-link"';

describe('inlineMarkdownToHtml', () => {
  it('leaves plain text alone', () => {
    expect(inlineMarkdownToHtml('plain text')).toBe('plain text');
  });

  it('renders links opening in a new tab', () => {
    expect(inlineMarkdownToHtml('see [docs](https://example.com/a)')).toBe(
      `see <a href="https://example.com/a" ${LINK_ATTRS}>docs</a>`,
    );
  });

  it('renders emphasis without wrapping in a paragraph', () => {
    expect(inlineMarkdownToHtml('**bold** and _it_')).toBe('<strong>bold</strong> and <em>it</em>');
  });

  it('strips javascript: hrefs', () => {
    expect(inlineMarkdownToHtml('[x](javascript:alert(1))')).toBe(`<a ${LINK_ATTRS}>x</a>`);
  });

  it('strips raw HTML event handlers', () => {
    expect(inlineMarkdownToHtml('<img src=x onerror="alert(1)">')).toBe('<img src="x">');
  });
});

describe('markdownToHtml', () => {
  it('renders paragraphs, line breaks and lists', () => {
    expect(markdownToHtml('one\ntwo\n\n- a\n- b')).toBe(
      '<p>one<br>two</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n',
    );
  });

  it('renders links opening in a new tab', () => {
    expect(markdownToHtml('[l](https://l.io)')).toBe(`<p><a href="https://l.io" ${LINK_ATTRS}>l</a></p>\n`);
  });

  it('strips script tags', () => {
    expect(markdownToHtml('hi <script>alert(1)</script>')).toBe('<p>hi </p>\n');
  });
});
