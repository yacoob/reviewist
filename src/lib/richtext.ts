import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Links in task text point outside the app; open them in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    node.classList.add('action-inline-link');
  }
});

/** Render a single line of markdown (task title) to sanitized HTML. */
export function inlineMarkdownToHtml(text: string): string {
  return DOMPurify.sanitize(marked.parseInline(text, { async: false }));
}

/** Render multi-line markdown (task description) to sanitized HTML. Single newlines become line breaks. */
export function markdownToHtml(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true }));
}
