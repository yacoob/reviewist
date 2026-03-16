import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProjects, fetchActivityEvents } from '../src/lib/api';
import type { ActivityEvent } from '../src/lib/types';

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

describe('fetchActivityEvents', () => {
  const sampleEvent: ActivityEvent = {
    id: 12345,
    event_date: '2026-02-20T10:00:00.000000Z',
    event_type: 'completed',
    object_id: 'abc123',
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: 'Buy milk' },
  };

  it('returns events from a single page', async () => {
    globalThis.fetch = mockFetch({ results: [sampleEvent] });

    const result = await fetchActivityEvents('tok', '2026-02-19');
    expect(result).toEqual([sampleEvent]);
  });

  it('pages through multiple pages using next_cursor', async () => {
    const event1 = { ...sampleEvent, object_id: 'a1' };
    const event2 = { ...sampleEvent, object_id: 'a2' };
    const event3 = { ...sampleEvent, object_id: 'a3' };

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ results: [event1, event2], next_cursor: 'cur1' }),
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [event3] }),
        text: () => Promise.resolve(''),
      });
    });

    const result = await fetchActivityEvents('tok', '2026-02-19');
    expect(result).toEqual([event1, event2, event3]);
    expect(callCount).toBe(2);

    // Second call should include cursor parameter
    const secondUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(secondUrl).toContain('cursor=cur1');
  });

  it('returns empty array when results is missing', async () => {
    globalThis.fetch = mockFetch({});

    const result = await fetchActivityEvents('tok', '2026-02-19');
    expect(result).toEqual([]);
  });

  it('builds correct URL with activity endpoint and parameters', async () => {
    const fn = mockFetch({ results: [] });
    globalThis.fetch = fn;

    await fetchActivityEvents('tok', '2026-02-01');

    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain('api.todoist.com/api/v1/activities');
    expect(url).toContain('date_from=2026-02-01');
    expect(url).not.toContain('date_to');
    expect(url).toContain('object_event_types=' + encodeURIComponent(JSON.stringify(['item:completed', 'item:uncompleted'])));
    expect(url).toContain('limit=100');
  });

  it('sends Authorization header with token', async () => {
    const fn = mockFetch({ results: [] });
    globalThis.fetch = fn;

    await fetchActivityEvents('tok', '2026-02-01');

    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('activities'),
      { headers: { Authorization: 'Bearer tok' } },
    );
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mockFetch('Unauthorized', 401);
    await expect(fetchActivityEvents('bad', '2026-02-01')).rejects.toThrow('HTTP 401');
  });

  it('throws on HTTP error mid-pagination', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ results: [sampleEvent], next_cursor: 'cur1' }),
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({
        ok: false, status: 500,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('Internal Server Error'),
      });
    });

    await expect(fetchActivityEvents('tok', '2026-02-01')).rejects.toThrow('HTTP 500');
  });
});
