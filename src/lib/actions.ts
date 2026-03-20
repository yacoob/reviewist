import type { ActivityEvent, CompletedAction, DedupedAction, Project } from './types';
import { reconcile } from './reconcile';
import { TODOIST_COLORS } from './colors';
import { formatDayLabel, fmtLocalDate } from './dates';
import { NOTE_PROJECT_EMOJIS } from './constants';

const LEADING_EMOJI_RE = /^\p{Extended_Pictographic}/u;

interface ProjectGroup {
  projectId: string;
  hex: string | null;
  unfiled: boolean;
  actions: DedupedAction[];
}

interface DayGroup {
  day: string;
  label: string;
  actionCount: number;
  projectGroups: ProjectGroup[];
}

function dedup(actions: CompletedAction[]): DedupedAction[] {
  const sorted = [...actions].sort((a, b) =>
    a.completed_at.localeCompare(b.completed_at),
  );
  const result: DedupedAction[] = [];
  const seen: Record<string, DedupedAction> = {};
  for (const t of sorted) {
    const key = t.content + '||' + t.project_id;
    if (seen[key]) {
      seen[key].count++;
      seen[key].allTimes.push(t.completed_at);
      seen[key].completed_at = t.completed_at; // always latest — ascending sort above
    } else {
      const entry: DedupedAction = { ...t, count: 1, allTimes: [t.completed_at] };
      seen[key] = entry;
      result.push(entry);
    }
  }
  return result;
}

/** Sort order: note projects first, then regular, unfiled last. Alphabetical within each tier. */
export function compareProjects(a: string, b: string, projects: Record<string, Project>, noteProjectIds: Set<string>): number {
  function tier(id: string): number {
    if (!projects[id]?.name) return 2;  // unfiled
    if (noteProjectIds.has(id)) return 0;  // note
    return 1;  // regular
  }
  const t = tier(a) - tier(b);
  if (t !== 0) return t;
  return (projects[a]?.name || '').toLowerCase().localeCompare((projects[b]?.name || '').toLowerCase());
}

/** Return the first letter (ignoring leading emoji/symbols), lowercased. */
export function sortKey(content: string): string {
  const m = content.match(/\p{Letter}/u);
  return m ? m[0].toLowerCase() : content.toLowerCase();
}

function groupByProject(actions: DedupedAction[], projects: Record<string, Project>, noteProjectIds: Set<string>): ProjectGroup[] {
  const byProject: Record<string, DedupedAction[]> = {};
  for (const t of actions) {
    (byProject[t.project_id] ??= []).push(t);
  }

  return Object.entries(byProject)
    .map(([pid, actions]) => {
      const proj = projects[pid];
      const unfiled = !proj?.name;
      const hex = unfiled ? TODOIST_COLORS.red : (proj?.color ? TODOIST_COLORS[proj.color] || null : null);
      if (noteProjectIds.has(pid)) {
        actions.sort((a, b) => sortKey(a.content).localeCompare(sortKey(b.content)));
      }
      return { projectId: pid, hex, unfiled, actions };
    })
    .sort((a, b) => compareProjects(a.projectId, b.projectId, projects, noteProjectIds));
}

export function prepareNotes(
  actions: CompletedAction[],
  noteProjectIds: Set<string>,
  projects: Record<string, Project>,
): CompletedAction[] {
  return actions.map(a => {
    if (!noteProjectIds.has(a.project_id)) return a;
    let content = a.content.replace(/^\*\s+/, '');
    if (!LEADING_EMOJI_RE.test(content)) {
      const projectName = projects[a.project_id]?.name;
      const emoji = projectName ? NOTE_PROJECT_EMOJIS[projectName] : undefined;
      if (emoji) {
        content = `${emoji} ${content}`;
      }
    }
    return { ...a, content };
  });
}

export function eventsToActions(
  events: ActivityEvent[],
  projects: Record<string, Project>,
  blocklist: ReadonlySet<string>,
  noteProjectIds: Set<string>,
): CompletedAction[] {
  const filtered = events.filter(e => !blocklist.has(e.object_id));
  return prepareNotes(reconcile(filtered), noteProjectIds, projects);
}

export function groupActionsByDay(actions: CompletedAction[], projects: Record<string, Project>, noteProjectIds: Set<string> = new Set()): DayGroup[] {
  const grouped: Record<string, CompletedAction[]> = {};
  for (const t of actions) {
    const date = t.completed_at ? fmtLocalDate(new Date(t.completed_at)) : 'Unknown';
    (grouped[date] ??= []).push(t);
  }

  return Object.keys(grouped)
    .sort()
    .reverse()
    .map((day) => {
      const deduped = dedup(grouped[day]);
      const projectGroups = groupByProject(deduped, projects, noteProjectIds);
      const label = day === 'Unknown' ? 'Unknown date' : formatDayLabel(day);
      return { day, label, actionCount: deduped.length, projectGroups };
    });
}
