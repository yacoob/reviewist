import type { ActivityEvent, CompletedTask } from './types';

/**
 * Reconcile activity events into completed tasks.
 *
 * Each `uncompleted` event cancels the most recent preceding `completed`
 * event for the same object_id. Surviving `completed` events are mapped
 * to CompletedTask objects for display.
 */
export function reconcile(events: ActivityEvent[]): CompletedTask[] {
  // Group by object_id
  const byId = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const group = byId.get(e.object_id) ?? [];
    group.push(e);
    byId.set(e.object_id, group);
  }

  const tasks: CompletedTask[] = [];

  for (const [, group] of byId) {
    // Sort chronologically within each group
    group.sort((a, b) => a.event_date.localeCompare(b.event_date));

    // Walk through: uncompleted cancels nearest preceding completed
    const surviving: ActivityEvent[] = [];
    for (const e of group) {
      if (e.event_type === 'uncompleted') {
        for (let i = surviving.length - 1; i >= 0; i--) {
          if (surviving[i].event_type === 'completed') {
            surviving.splice(i, 1);
            break;
          }
        }
      } else {
        surviving.push(e);
      }
    }

    // Map surviving completed events to CompletedTask
    for (const e of surviving) {
      if (e.event_type !== 'completed') continue;
      tasks.push({
        id: e.object_id + '|' + e.event_date,
        content: e.extra_data?.content ?? '',
        completed_at: e.event_date,
        project_id: e.parent_project_id ?? '',
        task_id: e.object_id,
      });
    }
  }

  return tasks;
}
