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
  const data = (await api(
    'https://api.todoist.com/api/v1/projects',
    token,
  )) as Record<string, unknown>[];
  const list = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>).results as Record<string, unknown>[]) ??
      data;
  const map: Record<string, Project> = {};
  if (Array.isArray(list)) {
    for (const p of list) {
      map[p.id as string] = {
        name: p.name as string,
        color: (p.color as string) || null,
      };
    }
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
  const data = await api(
    `https://api.todoist.com/api/v1/tasks/filter?query=${encodeURIComponent(filter)}`,
    token,
  );
  const items = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>).results as unknown[]) ?? [];
  return (items as Record<string, unknown>[]).map((t) => {
    const due = t.due as Record<string, string>;
    return {
      content: t.content as string,
      completed_at: due.date,
      project_id: t.project_id as string,
      section_id: (t.section_id as string) || '',
      task_id: t.id as string,
      id: `event-${t.id}`,
      labels: t.labels as string[] | undefined,
    };
  });
}
