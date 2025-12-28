import { Job } from './types';
import { useJobStore, logBuffers } from './store';
import { navigate } from 'wouter/use-browser-location';

export async function loadInitialData() {
  try {
    const res = await fetch('/api/jobs');
    const jobs: Job[] = await res.json();
    useJobStore.getState().setJobs(jobs);
    return jobs;
  } catch (e) {
    console.error('Initial load failed', e);
    return [];
  }
}

export async function fetchJobDetails(id: number) {
  try {
    const res = await fetch(`/api/jobs/${id}`);
    if (res.ok) {
      const job: Job = await res.json();
      if (job) {
        useJobStore.getState().updateJob(job);
      }
    }
  } catch (e) { console.error(e); }
}

export async function fetchJobLogs(id: number) {
  try {
    const res = await fetch(`/api/jobs/${id}/logs`);
    if (res.ok) {
      const text = await res.text();
      logBuffers[id] = text;
      window.dispatchEvent(new CustomEvent('job-logs-loaded', { detail: { jobId: id } }));
    }
  } catch (e) { console.error(e); }
}

let socket: WebSocket | null = null;

export function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws/state');
  socket = ws;

  ws.onmessage = (ev) => {
    try {
      if (typeof ev.data !== 'string') return;

      const msg = JSON.parse(ev.data);
      if (msg.type === 'job_snapshot' && msg.job) {
        const job = (msg.job as Job);

        const state = useJobStore.getState();
        const oldStatus = state.jobs[job.id]?.status;
        state.updateJob(job);
        if (job.id === state.selectedJobId) {
          if (oldStatus === 'running' && (job.status === 'success' || job.status === 'failed' || job.status === 'cancelled')) {
            if (job.status === 'success') {
              state.setConsoleCollapsed(true);
            }

            // If the current job finished, check if we should move to another one
            const otherRunningJob = Object.values(state.jobs).find(j => j.id !== job.id && j.status === 'running');
            if (otherRunningJob) {
              navigate(`/job/${otherRunningJob.id}`);
            } else {
              // No other job running yet, unpin so the next one that starts is auto-selected
              state.setIsPinned(false);
            }
          }
        } else if (job.status === 'running' && !state.isPinned) {
          navigate(`/job/${job.id}`);
        }
      } else if (msg.type === 'job_log') {
        window.dispatchEvent(new CustomEvent('job-log-stream', { detail: msg }));
      }
    } catch (e) { console.error(e); }
  };
  ws.onclose = () => {
    socket = null;
    setTimeout(connectWebSocket, 2000);
  }
}
