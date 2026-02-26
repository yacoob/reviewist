export interface CompletedTask {
  content: string;
  completed_at: string;
  project_id: string;
  section_id: string;
  task_id: string;
  id: string;
  labels?: string[];
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
