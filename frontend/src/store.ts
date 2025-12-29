import { create } from 'zustand';
import { AppState, Job } from './types';
import { fetchJobLogs, fetchJobDetails } from './api';

// Non-reactive log storage to avoid React re-render overhead
export const logBuffers: Record<number, string> = {};

export const useJobStore = create<AppState>((set) => ({
  jobs: {},
  selectedJobId: null,
  showArchived: false,
  // When true, newly running jobs will auto-navigate. Set to false when user explicitly selects a job.
  shouldAutoNavigateToNewJobs: false,

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

  // When selecting a job, by default we prevent auto-navigation to other jobs.
  // When deselecting (id = null), we enable auto-navigation again.
  selectJob: (id, preventAutoNavigate = true) => set((state) => {
    if (id === null) {
      return { selectedJobId: null, shouldAutoNavigateToNewJobs: true };
    }

    return { selectedJobId: id, shouldAutoNavigateToNewJobs: !preventAutoNavigate };
  }),

  setShouldAutoNavigateToNewJobs: (shouldAuto) => set({ shouldAutoNavigateToNewJobs: shouldAuto }),

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
