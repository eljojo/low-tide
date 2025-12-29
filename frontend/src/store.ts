import { create } from 'zustand';
import { AppState, Job } from './types';

// Non-reactive log storage to avoid React re-render overhead
export const logBuffers: Record<number, string> = {};

export const useJobStore = create<AppState>((set) => ({
  jobs: {},
  selectedJobId: null,
  showArchived: false,
  // When true, newly running jobs will auto-navigate (when at root and nothing is selected).
  // We default this to true so that a fresh page load at '/' can auto-select a currently running job.
  // It is set to false when the user explicitly selects or deselects a job.
  shouldAutoNavigateToNewJobs: true,

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
  // When deselecting (id = null), we *do not* automatically re-enable auto-navigation,
  // because that makes it impossible to stay on the homepage while a job is running.
  // Auto-navigation can still be explicitly enabled via setShouldAutoNavigateToNewJobs(true)
  // (e.g. when a selected job finishes and we want to auto-follow the next running job).
  selectJob: (id, preventAutoNavigate = true) => set((state) => {
    const prevSelected = state.selectedJobId;
    const prevShouldAuto = state.shouldAutoNavigateToNewJobs;

    if (id === null) {
      // If nothing was selected already, keep the existing auto-navigate setting.
      // (Important on initial app mount at '/', where we call selectJob(null) just
      // to normalize state.)
      return {
        selectedJobId: null,
        shouldAutoNavigateToNewJobs: prevSelected === null ? prevShouldAuto : false,
      };
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
