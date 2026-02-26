import type { CompletedTask, DedupedTask, Project } from './types';
import { TODOIST_COLORS } from './colors';
import { formatDayLabel } from './dates';

export interface ProjectGroup {
  projectId: string;
  hex: string | null;
  unfiled: boolean;
  tasks: DedupedTask[];
}

export interface DayGroup {
  day: string;
  label: string;
  taskCount: number;
  projectGroups: ProjectGroup[];
}

function dedup(tasks: CompletedTask[]): DedupedTask[] {
  const sorted = [...tasks].sort((a, b) =>
    (a.completed_at || '').localeCompare(b.completed_at || ''),
  );
  const result: DedupedTask[] = [];
  const seen: Record<string, DedupedTask> = {};
  for (const t of sorted) {
    const key = (t.content || '') + '||' + (t.project_id || '');
    if (seen[key]) {
      seen[key].count++;
      seen[key].allTimes.push(t.completed_at || '');
      if ((t.completed_at || '') > (seen[key].completed_at || '')) {
        seen[key].completed_at = t.completed_at;
      }
    } else {
      const entry: DedupedTask = { ...t, count: 1, allTimes: [t.completed_at || ''] };
      seen[key] = entry;
      result.push(entry);
    }
  }
  return result;
}

function groupByProject(tasks: DedupedTask[], projects: Record<string, Project>): ProjectGroup[] {
  const byProject: Record<string, DedupedTask[]> = {};
  for (const t of tasks) {
    const pid = t.project_id || '';
    (byProject[pid] ??= []).push(t);
  }

  return Object.entries(byProject)
    .map(([pid, tasks]) => {
      const proj = projects[pid];
      const unfiled = !proj?.name;
      const hex = unfiled ? TODOIST_COLORS.red : (proj?.color ? TODOIST_COLORS[proj.color] || null : null);
      return { projectId: pid, hex, unfiled, tasks };
    })
    .sort((a, b) => {
      if (a.unfiled !== b.unfiled) return a.unfiled ? 1 : -1;
      const nameA = (projects[a.projectId]?.name || '').toLowerCase();
      const nameB = (projects[b.projectId]?.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
}

export function groupTasksByDay(tasks: CompletedTask[], projects: Record<string, Project>): DayGroup[] {
  const grouped: Record<string, CompletedTask[]> = {};
  for (const t of tasks) {
    const date = (t.completed_at || '').split('T')[0] || 'Unknown';
    (grouped[date] ??= []).push(t);
  }

  return Object.keys(grouped)
    .sort()
    .reverse()
    .map((day) => {
      const deduped = dedup(grouped[day]);
      const projectGroups = groupByProject(deduped, projects);
      const label = day === 'Unknown' ? 'Unknown date' : formatDayLabel(day);
      return { day, label, taskCount: deduped.length, projectGroups };
    });
}
