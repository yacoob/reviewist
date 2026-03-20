import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabel } from './dates';
import { sortKey } from './actions';

interface DedupEntry {
  content: string;
  time: string;
  is_note: boolean;
  count: number;
  completed_at: string;
}

export function renderMarkdown(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
): string {
  const lines: string[] = [`# Review: ${range.since} to ${range.until}`];

  // Group by local date
  const byDay: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    const date = a.completed_at ? fmtLocalDate(new Date(a.completed_at)) : 'Unknown';
    (byDay[date] ??= []).push(a);
  }

  const sortedDates = Object.keys(byDay).sort();

  for (const date of sortedDates) {
    const dayActions = byDay[date];
    const sorted = [...dayActions].sort((a, b) =>
      a.completed_at.localeCompare(b.completed_at),
    );

    // Dedup recurring actions
    const seen: Record<string, DedupEntry> = {};
    const deduped: DedupEntry[] = [];
    for (const a of sorted) {
      const key = a.content + '||' + a.project_id;
      if (seen[key]) {
        seen[key].count++;
        seen[key].time = fmtLocalTime(a.completed_at);
        seen[key].completed_at = a.completed_at;
      } else {
        const isNote = noteProjectIds.has(a.project_id);
        const content = isNote ? a.content.replace(/^\*\s+/, '') : a.content;
        const entry: DedupEntry = {
          content,
          time: fmtLocalTime(a.completed_at),
          is_note: isNote,
          count: 1,
          completed_at: a.completed_at,
        };
        seen[key] = entry;
        deduped.push(entry);
      }
    }

    // Notes first (alphabetical), then actions (by time)
    const notes = deduped.filter(d => d.is_note);
    const tasks = deduped.filter(d => !d.is_note);
    notes.sort((a, b) => sortKey(a.content).localeCompare(sortKey(b.content)));
    tasks.sort((a, b) => a.completed_at.localeCompare(b.completed_at));

    const label = date === 'Unknown' ? 'Unknown date' : formatDayLabel(date);
    lines.push('', `## ${label}`);

    for (const note of notes) {
      lines.push(`- ${note.content}`);
    }
    for (const task of tasks) {
      const count = task.count > 1 ? ` ×${task.count}` : '';
      lines.push(`- ${task.time} · ${task.content}${count}`);
    }
  }

  return lines.join('\n') + '\n';
}
