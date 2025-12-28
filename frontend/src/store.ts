import { create } from 'zustand';
import { AppState, Job } from './types';
import { fetchJobLogs, fetchJobDetails } from './api';

// Non-reactive log storage to avoid React re-render overhead
export const logBuffers: Record<number, string> = {};

export const useJobStore = create<AppState>((set) => ({
  jobs: {},
  selectedJobId: null,
  showArchived: false,
  isPinned: false,
  consoleCollapsed: true,

  setJobs: (jobs) => set((state) => {
    const newJobs: Record<number, Job> = {};
    jobs.forEach(j => {
      newJobs[j.id] = { ...state.jobs[j.id], ...j };
    });
    return { jobs: newJobs };
  }),

  updateJob: (job) => set((state) => ({
    jobs: {
      ...state.jobs,
      [job.id]: { ...state.jobs[job.id], ...job }
    }
  })),

  selectJob: (id, pinned = true) => set((state) => {
    if (id === null) {
      return { selectedJobId: null, isPinned: false };
    }

    const job = state.jobs[id];
    let consoleCollapsed = state.consoleCollapsed;
    if (job) {
      consoleCollapsed = job.status === 'success';
    } else {
      // If job is not in store yet (e.g. just queued), expand console to show progress
      consoleCollapsed = false;
    }
    return { selectedJobId: id, consoleCollapsed, isPinned: pinned };
  }),

  setIsPinned: (isPinned) => set({ isPinned }),

  deleteJob: (id) => set((state) => {
    const newJobs = { ...state.jobs };
    delete newJobs[id];
    delete logBuffers[id];
    return {
      jobs: newJobs,
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId
    };
  }),

  toggleArchived: () => set((state) => ({ showArchived: !state.showArchived })),
  toggleConsole: () => set((state) => ({ consoleCollapsed: !state.consoleCollapsed })),
  setConsoleCollapsed: (collapsed) => set({ consoleCollapsed: collapsed }),
}));
