// ABOUTME: TypeScript interfaces for Todoist API responses and internal state.
// ABOUTME: Covers completed tasks, projects, and display-ready task entries.

export interface CompletedTask {
  content: string;
  completed_at: string;
  project_id: string;
  section_id: string;
  task_id: string;
  id: string;
  labels?: string[];
  is_event?: boolean;
}

export interface Project {
  name: string;
  color: string | null;
}

export interface DedupedTask extends CompletedTask {
  count: number;
  allTimes: string[];
}

export type StatusType = 'error' | 'info' | 'loading' | null;
