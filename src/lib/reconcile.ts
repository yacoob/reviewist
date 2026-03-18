import type { ActivityEvent, CompletedAction } from './types';

/**
 * Reconcile activity events into completed tasks.
 *
 * Each `uncompleted` event cancels the most recent preceding `completed`
 * event for the same object_id. Surviving `completed` events are mapped
 * to CompletedAction objects for display.
 */
export function reconcile(events: ActivityEvent[]): CompletedAction[] {
  // Sort all events chronologically
  events.sort((a, b) => a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0);

  // Single walk: coalesce events per task, uncompletes pop the latest
  const byId = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    if (e.event_type === 'completed') {
      let list = byId.get(e.object_id);
      if (!list) {
        list = [];
        byId.set(e.object_id, list);
      }
      list.push(e);
    } else {
      byId.get(e.object_id)?.pop();
    }
  }

  // Flatten and map to CompletedAction
  const tasks: CompletedAction[] = [];
  for (const list of byId.values()) {
    for (const e of list) {
      tasks.push({
        id: e.object_id + '|' + e.event_date,
        content: e.extra_data?.content ?? '',
        completed_at: e.event_date,
        project_id: e.parent_project_id ?? '',
        task_id: e.object_id,
      });
    }
  }
  tasks.sort((a, b) => a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : 0);
  return tasks;
}
