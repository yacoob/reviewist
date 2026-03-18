import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabel } from './dates';
import { sortKey } from './actions';

export interface TemplateAction {
  content: string;
  time: string;
  project_name: string;
  project_color: string | null;
  is_note: boolean;
  count: number;
}

export interface TemplateDay {
  date: string;
  label: string;
  actions: TemplateAction[];
}

export interface TemplateData {
  days: TemplateDay[];
  range: { since: string; until: string };
}

interface Accumulator {
  action: TemplateAction;
  completed_at: string;
}

export function buildTemplateData(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
): TemplateData {
  const byDay: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    const date = a.completed_at ? fmtLocalDate(new Date(a.completed_at)) : 'Unknown';
    (byDay[date] ??= []).push(a);
  }

  const days: TemplateDay[] = Object.keys(byDay)
    .sort()
    .map(date => {
      const dayActions = byDay[date];
      const sorted = [...dayActions].sort((a, b) =>
        a.completed_at.localeCompare(b.completed_at),
      );

      const seen: Record<string, Accumulator> = {};
      const deduped: Accumulator[] = [];
      for (const a of sorted) {
        const key = a.content + '||' + a.project_id;
        const proj = projects[a.project_id];
        if (seen[key]) {
          seen[key].action.count++;
          seen[key].action.time = fmtLocalTime(a.completed_at);
          seen[key].completed_at = a.completed_at;
        } else {
          const isNote = noteProjectIds.has(a.project_id);
          const content = isNote ? a.content.replace(/^\*\s+/, '') : a.content;
          const acc: Accumulator = {
            action: {
              content,
              time: fmtLocalTime(a.completed_at),
              project_name: proj?.name ?? 'Unknown',
              project_color: proj?.color ?? null,
              is_note: isNote,
              count: 1,
            },
            completed_at: a.completed_at,
          };
          seen[key] = acc;
          deduped.push(acc);
        }
      }

      const notes = deduped.filter(d => d.action.is_note);
      const tasks = deduped.filter(d => !d.action.is_note);
      notes.sort((a, b) => sortKey(a.action.content).localeCompare(sortKey(b.action.content)));
      tasks.sort((a, b) => a.completed_at.localeCompare(b.completed_at));

      const label = date === 'Unknown' ? 'Unknown date' : formatDayLabel(date);
      return { date, label, actions: [...notes, ...tasks].map(d => d.action) };
    });

  return { days, range };
}
