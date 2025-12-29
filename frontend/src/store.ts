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

    return { selectedJobId: id, isPinned: pinned };
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
}));
