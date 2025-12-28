import { Job } from './types';
import { useJobStore, logBuffers } from './store';

export async function loadInitialData() {
  try {
    const res = await fetch('/api/jobs');
    const jobs: Job[] = await res.json();
    useJobStore.getState().setJobs(jobs);

    const state = useJobStore.getState();
    if (state.selectedJobId === null) { // due to no selection from URL
      const runningJob = jobs.find(j => j.status === 'running');
      if (runningJob) {
        state.selectJob(runningJob.id);
      }
    }
  } catch (e) {
    console.error('Initial load failed', e);
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
          if (oldStatus === 'running' && job.status === 'success') {
            state.setConsoleCollapsed(true);
          }
        } else if (job.status === 'running' && !state.isPinned) {
          useJobStore.getState().selectJob(job.id);
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
