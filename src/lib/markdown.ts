import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabel, isoWeek } from './dates';
import { sortActions } from './actions';

interface DedupEntry {
  content: string;
  time: string;
  is_note: boolean;
  count: number;
  completed_at: string;
  project_id: string;
}

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

    // Dedup recurring actions (preserves sorted order)
    const seen: Record<string, DedupEntry> = {};
    const deduped: DedupEntry[] = [];
    for (const a of byDay[date]) {
      const key = a.content + '||' + a.project_id;
      if (seen[key]) {
        seen[key].count++;
        seen[key].time = fmtLocalTime(a.completed_at);
        seen[key].completed_at = a.completed_at;
      } else {
        const entry: DedupEntry = {
          content: a.content,
          time: fmtLocalTime(a.completed_at),
          is_note: noteProjectIds.has(a.project_id),
          count: 1,
          completed_at: a.completed_at,
          project_id: a.project_id,
        };
        seen[key] = entry;
        deduped.push(entry);
      }
    }

    const label = date === 'Unknown' ? 'Unknown date' : formatDayLabel(date);
    lines.push('', `## ${label}`);

    for (const entry of deduped) {
      if (entry.is_note) {
        lines.push(`> ${entry.content}`);
      } else {
        const count = entry.count > 1 ? ` ×${entry.count}` : '';
        lines.push(`- [x] ${entry.time} · ${entry.content}${count}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}
