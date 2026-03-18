import nunjucks from 'nunjucks';
import { readFileSync, existsSync } from 'node:fs';

import markdownTemplate from '../templates/markdown.njk' with { type: 'text' };

const builtins: Record<string, string> = {
  markdown: markdownTemplate,
};

export const BUILTIN_FORMATS = Object.keys(builtins);

const env = new nunjucks.Environment(null, { autoescape: false, trimBlocks: true, lstripBlocks: true });

export function renderTemplate(format: string, data: object): string {
  if (builtins[format]) {
    return env.renderString(builtins[format], data);
  }

  if (existsSync(format)) {
    const template = readFileSync(format, 'utf-8');
    return env.renderString(template, data);
  }

  const available = BUILTIN_FORMATS.join(', ');
  throw new Error(
    `Unknown format "${format}". Built-in formats: ${available}. Or provide a path to a .njk template file.`,
  );
}
