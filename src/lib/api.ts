import type { CompletedTask, Project } from './types';

/** Todoist project name for non-task entries (events, notes). Used in filter queries. */
const EVENT_PROJECT_NAME = 'Aside';

async function api(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchProjects(
  token: string,
): Promise<Record<string, Project>> {
  const list = (await api(
    'https://api.todoist.com/api/v1/projects',
    token,
  )) as { id: string; name: string; color?: string }[];
  const map: Record<string, Project> = {};
  for (const p of list) {
    map[p.id] = { name: p.name, color: p.color || null };
  }
  return map;
}

export async function fetchCompletedTasks(
  token: string,
  since: string,
  until: string,
): Promise<CompletedTask[]> {
  const sinceISO = new Date(since + 'T00:00:00').toISOString();
  const untilISO = new Date(until + 'T23:59:59').toISOString();
  const data = (await api(
    `https://api.todoist.com/api/v1/tasks/completed?since=${sinceISO}&until=${untilISO}&limit=200`,
    token,
  )) as Record<string, unknown>;
  return (data.items ?? []) as CompletedTask[];
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchEventTasks(
  token: string,
  since: string,
  until: string,
): Promise<CompletedTask[]> {
  const filter = `#${EVENT_PROJECT_NAME} & due after: ${since} & due before: ${nextDay(until)} & uncompletable`;
  const data = (await api(
    `https://api.todoist.com/api/v1/tasks/filter?query=${encodeURIComponent(filter)}`,
    token,
  )) as { results: { id: string; content: string; project_id: string; section_id?: string; labels?: string[]; due: { date: string } }[] };
  return data.results.map((t) => ({
    content: t.content,
    completed_at: t.due.date,
    project_id: t.project_id,
    section_id: t.section_id || '',
    task_id: t.id,
    id: `event-${t.id}`,
    labels: t.labels,
  }));
}
