export interface CompletedTask {
  content: string;
  completed_at: string;
  project_id: string;
  task_id: string;
  id: string;
}

export interface Project {
  name: string;
  color: string | null;
}

export interface DedupedTask extends CompletedTask {
  count: number;
  allTimes: string[];
}

export type StatusType = 'error' | 'info' | null;

export type ActivityEventType = 'completed' | 'uncompleted';

export interface ActivityEvent {
  id: unknown; // Large number, loses precision as JSON float — do not use as key
  event_date: string;
  event_type: ActivityEventType;
  object_id: string;
  object_type: string;
  parent_project_id: string | null;
  parent_item_id: string | null;
  initiator_id: string;
  extra_data: {
    content?: string;
    client?: string;
    note_count?: number;
  };
}
