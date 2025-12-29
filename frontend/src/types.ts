export interface FileInfo {
  id: number;
  path: string;
  size_bytes: number;
}

export interface Job {
  id: number;
  title?: string;
  url?: string;
  original_url?: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'cleaned';
  created_at: string;
  archived: boolean;
  image_path?: string;
  files?: FileInfo[];
}

export interface AppConfig {
  id: string;
  name: string;
}

export interface AppState {
  jobs: Record<number, Job>;
  selectedJobId: number | null;
  showArchived: boolean;
  shouldAutoNavigateToNewJobs: boolean;
  setJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;
  selectJob: (id: number | null, preventAutoNavigate?: boolean) => void;
  setShouldAutoNavigateToNewJobs: (shouldAuto: boolean) => void;
  deleteJob: (id: number) => void;
  toggleArchived: () => void;
}

declare global {
  interface Window {
    CONFIG: {
      apps: AppConfig[];
    };
  }
}
