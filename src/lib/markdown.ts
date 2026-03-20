import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabelStatic, isoWeek } from './dates';
import { dedup, sortActions } from './actions';

export function renderMarkdown(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
  title?: string,
): string {
  const lines: string[] = [
    '---',
    'cssclasses: [reviewist]',
    '---',
    '',
    `# ${title ?? `Review: ${range.since} to ${range.until}`}`,
  ];

  const sorted = sortActions(actions, projects, noteProjectIds);
  const byDay: Record<string, CompletedAction[]> = {};
  for (const a of sorted) {
    const date = a.completed_at ? fmtLocalDate(new Date(a.completed_at)) : 'Unknown';
    (byDay[date] ??= []).push(a);
  }

  const sortedDates = Object.keys(byDay).sort();

  let lastWeek: number | null = null;
  for (const date of sortedDates) {
    const week = date === 'Unknown' ? -1 : isoWeek(date);
    if (lastWeek !== null && week !== lastWeek) {
      lines.push('', '---');
    }
    lastWeek = week;

    const deduped = dedup(byDay[date]);

    const label = date === 'Unknown' ? 'Unknown date' : formatDayLabelStatic(date);
    lines.push('', `## ${label}`);

    for (const entry of deduped) {
      if (noteProjectIds.has(entry.project_id)) {
        lines.push(`> ${entry.content}`);
      } else {
        const time = fmtLocalTime(entry.completed_at);
        const count = entry.count > 1 ? ` ×${entry.count}` : '';
        lines.push(`- [x] ${time} · ${entry.content}${count}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}
