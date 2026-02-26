import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProjects, fetchCompletedTasks, fetchEventTasks } from './api';

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchProjects', () => {
  it('unwraps paginated { results } response into id-keyed map', async () => {
    globalThis.fetch = mockFetch({
      results: [
        { id: '1001', name: 'Inbox', color: 'blue' },
        { id: '1002', name: 'Aside', color: 'grey' },
      ],
    });

    const projects = await fetchProjects('fake-token');

    expect(projects).toEqual({
      '1001': { name: 'Inbox', color: 'blue' },
      '1002': { name: 'Aside', color: 'grey' },
    });
  });

  it('defaults missing color to null', async () => {
    globalThis.fetch = mockFetch({
      results: [{ id: '1', name: 'NoColor' }],
    });

    const projects = await fetchProjects('tok');
    expect(projects['1'].color).toBeNull();
  });

  it('sends Authorization header with token', async () => {
    const fn = mockFetch({ results: [] });
    globalThis.fetch = fn;

    await fetchProjects('my-secret-token');

    expect(fn).toHaveBeenCalledWith(
      'https://api.todoist.com/api/v1/projects',
      { headers: { Authorization: 'Bearer my-secret-token' } },
    );
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mockFetch({ error: 'forbidden' }, 403);
    await expect(fetchProjects('bad')).rejects.toThrow('HTTP 403');
  });
});

describe('fetchCompletedTasks', () => {
  it('unwraps { items } from response', async () => {
    const items = [
      {
        content: 'Buy milk',
        completed_at: '2026-02-20T10:00:00Z',
        project_id: 'p1',
        section_id: 's1',
        task_id: 't1',
        id: 'c1',
      },
      {
        content: 'Feed cats',
        completed_at: '2026-02-20T18:00:00Z',
        project_id: 'p2',
        section_id: '',
        task_id: 't2',
        id: 'c2',
      },
    ];
    globalThis.fetch = mockFetch({ items });

    const result = await fetchCompletedTasks('tok', '2026-02-19', '2026-02-20');
    expect(result).toEqual(items);
  });

  it('returns empty array when items is missing', async () => {
    globalThis.fetch = mockFetch({});

    const result = await fetchCompletedTasks('tok', '2026-02-19', '2026-02-20');
    expect(result).toEqual([]);
  });

  it('builds correct URL with ISO date boundaries', async () => {
    const fn = mockFetch({ items: [] });
    globalThis.fetch = fn;

    await fetchCompletedTasks('tok', '2026-02-01', '2026-02-07');

    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain('api.todoist.com/api/v1/tasks/completed');
    // since should be start of day
    expect(url).toContain('since=' + new Date('2026-02-01T00:00:00').toISOString());
    // until should be end of day
    expect(url).toContain('until=' + new Date('2026-02-07T23:59:59').toISOString());
    expect(url).toContain('limit=200');
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mockFetch('Unauthorized', 401);
    await expect(fetchCompletedTasks('bad', '2026-02-01', '2026-02-07')).rejects.toThrow('HTTP 401');
  });
});

describe('fetchEventTasks', () => {
  it('unwraps { results } and maps to CompletedTask shape', async () => {
    globalThis.fetch = mockFetch({
      results: [
        {
          id: 'e1',
          content: '* Dawn returns from London',
          project_id: 'p_aside',
          section_id: 'sec1',
          labels: ['travel'],
          due: { date: '2026-02-20' },
        },
        {
          id: 'e2',
          content: '* Vet appointment',
          project_id: 'p_aside',
          labels: [],
          due: { date: '2026-02-21' },
        },
      ],
    });

    const result = await fetchEventTasks('tok', '2026-02-19', '2026-02-21');

    expect(result).toEqual([
      {
        content: '* Dawn returns from London',
        completed_at: '2026-02-20',
        project_id: 'p_aside',
        section_id: 'sec1',
        task_id: 'e1',
        id: 'event-e1',
        labels: ['travel'],
      },
      {
        content: '* Vet appointment',
        completed_at: '2026-02-21',
        project_id: 'p_aside',
        section_id: '',
        task_id: 'e2',
        id: 'event-e2',
        labels: [],
      },
    ]);
  });

  it('builds filter query with Aside project and correct date range', async () => {
    const fn = mockFetch({ results: [] });
    globalThis.fetch = fn;

    await fetchEventTasks('tok', '2026-02-19', '2026-02-25');

    const url = fn.mock.calls[0][0] as string;
    const queryParam = decodeURIComponent(url.split('query=')[1]);
    expect(queryParam).toBe('#Aside & due after: 2026-02-19 & due before: 2026-02-26 & uncompletable');
  });

  it('computes next day correctly for until boundary', async () => {
    const fn = mockFetch({ results: [] });
    globalThis.fetch = fn;

    await fetchEventTasks('tok', '2026-02-28', '2026-03-01');

    const url = fn.mock.calls[0][0] as string;
    const queryParam = decodeURIComponent(url.split('query=')[1]);
    // March 1 + 1 = March 2
    expect(queryParam).toContain('due before: 2026-03-02');
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mockFetch('Server error', 500);
    await expect(fetchEventTasks('bad', '2026-02-01', '2026-02-07')).rejects.toThrow('HTTP 500');
  });
});
