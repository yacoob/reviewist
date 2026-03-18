import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { renderTemplate, BUILTIN_FORMATS } from '../src/lib/render';
import type { TemplateData } from '../src/lib/template-data';

const data: TemplateData = {
  days: [
    {
      date: '2026-02-20',
      label: 'Feb 20 · Friday',
      actions: [
        {
          content: 'Buy milk',
          time: '11:00',
          project_name: 'Home',
          project_color: 'green',
          is_note: false,
          count: 1,
        },
      ],
    },
  ],
  range: { since: '2026-02-01', until: '2026-02-28' },
};

describe('renderTemplate', () => {
  it('renders a built-in template by name', () => {
    const result = renderTemplate('markdown', data);
    expect(result).toContain('Buy milk');
    expect(result).toContain('Feb 20');
  });

  it('throws for unknown format with no matching file', () => {
    expect(() => renderTemplate('nonexistent', data)).toThrow();
  });

  it('lists markdown in BUILTIN_FORMATS', () => {
    expect(BUILTIN_FORMATS).toContain('markdown');
  });

  it('renders notes with bold content', () => {
    const noteData: TemplateData = {
      days: [{
        date: '2026-02-20',
        label: 'Feb 20 · Friday',
        actions: [{
          content: 'Dawn returns',
          time: '14:00',
          project_name: 'Aside',
          project_color: 'grey',
          is_note: true,
          count: 1,
        }],
      }],
      range: { since: '2026-02-01', until: '2026-02-28' },
    };
    const result = renderTemplate('markdown', noteData);
    expect(result).toContain('**Dawn returns**');
  });

  it('renders recurring action count', () => {
    const recurringData: TemplateData = {
      days: [{
        date: '2026-02-20',
        label: 'Feb 20 · Friday',
        actions: [{
          content: 'Water plants',
          time: '09:00',
          project_name: 'Home',
          project_color: 'green',
          is_note: false,
          count: 3,
        }],
      }],
      range: { since: '2026-02-01', until: '2026-02-28' },
    };
    const result = renderTemplate('markdown', recurringData);
    expect(result).toContain('×3');
  });

  it('renders from a filesystem path', () => {
    const tmpPath = '/tmp/test-reviewist-template.njk';
    writeFileSync(tmpPath, '{{ range.since }} to {{ range.until }}');
    try {
      const result = renderTemplate(tmpPath, data);
      expect(result).toBe('2026-02-01 to 2026-02-28');
    } finally {
      unlinkSync(tmpPath);
    }
  });
});
