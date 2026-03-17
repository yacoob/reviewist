import type { CompletedTask, DedupedTask, Project } from './types';
import { TODOIST_COLORS } from './colors';
import { formatDayLabel, fmtLocalDate } from './dates';

interface ProjectGroup {
  projectId: string;
  hex: string | null;
  unfiled: boolean;
  tasks: DedupedTask[];
}

interface DayGroup {
  day: string;
  label: string;
  taskCount: number;
  projectGroups: ProjectGroup[];
}

function dedup(tasks: CompletedTask[]): DedupedTask[] {
  const sorted = [...tasks].sort((a, b) =>
    a.completed_at.localeCompare(b.completed_at),
  );
  const result: DedupedTask[] = [];
  const seen: Record<string, DedupedTask> = {};
  for (const t of sorted) {
    const key = t.content + '||' + t.project_id;
    if (seen[key]) {
      seen[key].count++;
      seen[key].allTimes.push(t.completed_at);
      seen[key].completed_at = t.completed_at; // always latest — ascending sort above
    } else {
      const entry: DedupedTask = { ...t, count: 1, allTimes: [t.completed_at] };
      seen[key] = entry;
      result.push(entry);
    }
  }
  return result;
}

/** Compare two project IDs for sorting: event projects first (alphabetically), then the rest (alphabetically), unfiled last. */
export function compareProjects(a: string, b: string, projects: Record<string, Project>, eventProjectIds: Set<string>): number {
  const projA = projects[a];
  const projB = projects[b];
  const unfiledA = !projA?.name;
  const unfiledB = !projB?.name;
  if (unfiledA !== unfiledB) return Number(unfiledA) - Number(unfiledB);
  const eventA = eventProjectIds.has(a);
  const eventB = eventProjectIds.has(b);
  if (eventA !== eventB) return eventA ? -1 : 1;
  const nameA = (projA?.name || '').toLowerCase();
  const nameB = (projB?.name || '').toLowerCase();
  return nameA.localeCompare(nameB);
}

/** Return the first letter (ignoring leading emoji/symbols), lowercased. */
export function sortKey(content: string): string {
  const m = content.match(/\p{Letter}/u);
  return m ? m[0].toLowerCase() : content.toLowerCase();
}

function groupByProject(tasks: DedupedTask[], projects: Record<string, Project>, eventProjectIds: Set<string>): ProjectGroup[] {
  const byProject: Record<string, DedupedTask[]> = {};
  for (const t of tasks) {
    (byProject[t.project_id] ??= []).push(t);
  }

  return Object.entries(byProject)
    .map(([pid, tasks]) => {
      const proj = projects[pid];
      const unfiled = !proj?.name;
      const hex = unfiled ? TODOIST_COLORS.red : (proj?.color ? TODOIST_COLORS[proj.color] || null : null);
      if (eventProjectIds.has(pid)) {
        tasks.sort((a, b) => sortKey(a.content).localeCompare(sortKey(b.content)));
      }
      return { projectId: pid, hex, unfiled, tasks };
    })
    .sort((a, b) => compareProjects(a.projectId, b.projectId, projects, eventProjectIds));
}

export function groupTasksByDay(tasks: CompletedTask[], projects: Record<string, Project>, eventProjectIds: Set<string> = new Set()): DayGroup[] {
  const grouped: Record<string, CompletedTask[]> = {};
  for (const t of tasks) {
    const date = t.completed_at ? fmtLocalDate(new Date(t.completed_at)) : 'Unknown';
    (grouped[date] ??= []).push(t);
  }

  return Object.keys(grouped)
    .sort()
    .reverse()
    .map((day) => {
      const deduped = dedup(grouped[day]);
      const projectGroups = groupByProject(deduped, projects, eventProjectIds);
      const label = day === 'Unknown' ? 'Unknown date' : formatDayLabel(day);
      return { day, label, taskCount: deduped.length, projectGroups };
    });
}
