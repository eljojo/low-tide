import { render, h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { create } from 'zustand';

interface FileInfo {
  id: number;
  path: string;
  size_bytes: number;
}

interface Job {
  id: number;
  title?: string;
  url?: string;
  original_url?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  created_at: string;
  archived: boolean;
  files?: FileInfo[];
  has_logs: boolean;
}

interface AppConfig {
  id: string;
  name: string;
}

declare global {
  interface Window { CONFIG: { apps: AppConfig[] }; }
}

interface AppState {
  jobs: Record<number, Job>;
  selectedJobId: number | null;
  showArchived: boolean;
  consoleCollapsed: boolean;
  setJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;
  selectJob: (id: number) => void;
  deleteJob: (id: number) => void;
  toggleArchived: () => void;
  toggleConsole: () => void;
  setConsoleCollapsed: (collapsed: boolean) => void;
}

// Non-reactive log storage to avoid React re-render overhead
const logBuffers: Record<number, string> = {};

const useJobStore = create<AppState>((set) => ({
  jobs: {},
  selectedJobId: null,
  showArchived: false,
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

  selectJob: (id) => set((state) => {
    const job = state.jobs[id];
    if (job?.has_logs && !logBuffers[id]) {
        // Need to trigger fetch
        setTimeout(() => fetchJobLogs(id), 0);
    }

    let consoleCollapsed = state.consoleCollapsed;
    if (job) {
      consoleCollapsed = job.status === 'success';
    }
    return { selectedJobId: id, consoleCollapsed };
  }),

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

async function loadInitialData() {
  try {
    const res = await fetch('/api/jobs');
    const jobs: Job[] = await res.json();
    useJobStore.getState().setJobs(jobs);

    const runningJob = jobs.find(j => j.status === 'running');
    if (runningJob) {
      useJobStore.getState().selectJob(runningJob.id);
    }
  } catch (e) {
    console.error('Initial load failed', e);
  }
}

async function fetchJobDetails(id: number) {
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

async function fetchJobLogs(id: number) {
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

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws/state');
  socket = ws;

  ws.onmessage = (ev) => {
    try {
      if (typeof ev.data !== 'string') return;
      
      const msg = JSON.parse(ev.data);
      if (msg.type === 'job_snapshot' && msg.job) {
        const job = (msg.job as Job);

        const oldStatus = useJobStore.getState().jobs[job.id]?.status;
        useJobStore.getState().updateJob(job);
        if (job.id === useJobStore.getState().selectedJobId) {
          if (oldStatus === 'running' && job.status === 'success') {
            useJobStore.getState().setConsoleCollapsed(true);
          }
        } else if (job.status === 'running') {
          useJobStore.getState().selectJob(job.id);
          fetchJobDetails(job.id);
        }
      } else if (msg.type === 'job_log') {
        logBuffers[msg.job_id] = msg.html;
        window.dispatchEvent(new CustomEvent('job-log-stream', { detail: { jobId: msg.job_id, html: msg.html } }));
      } else if (msg.type === 'jobs_archived') {
        loadInitialData();
      }
    } catch (e) { console.error(e); }
  };
  ws.onclose = () => {
    socket = null;
    setTimeout(connectWebSocket, 2000);
  }
}

// --- HELPERS ---

function humanSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  const b = Number(bytes);
  if (b < 1024) return b + ' B';
  const kb = b / 1024;
  if (kb < 1024) return Math.round(kb) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return Math.round(mb) + ' MB';
  const gb = mb / 1024;
  return Math.round(gb) + ' GB';
}

// --- COMPONENTS ---

const Header = () => {
  const isAnyJobRunning = useJobStore((s) => Object.values(s.jobs).some(j => j.status === 'running'));

  return (
    <header>
      <div className="blob"></div>
      <a href="/" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
        <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Low Tide</h1>
      </a>
      <div id="global-indicator" style={{ display: isAnyJobRunning ? 'block' : 'none' }}></div>
    </header>
  );
};

const NewJobForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const res = await fetch('/api/jobs', { method: 'POST', body: fd });
    if (res.ok) {
      formRef.current.reset();
    }
  };

  return (
    <section className="card">
      <h2>New Download Job</h2>
      <form ref={formRef} onSubmit={handleSubmit}>
        <label htmlFor="app">Downloader</label>
        <select id="app" name="app_id">
          <option value="auto">Auto-detect</option>
          {(window.CONFIG?.apps || []).map(app => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>

        <label htmlFor="urls">URLs (one per line or space-separated)</label>
        <textarea id="urls" name="urls" rows={4} placeholder={`https://example.com/file1.mp3
https://example.com/file2.mp3`}></textarea>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.8rem' }}>
          <button type="submit">Queue Job</button>
        </div>
      </form>
    </section>
  );
};

const JobItem = ({ job, selected }: { job: Job, selected: boolean }) => {
  const handleClick = () => {
    useJobStore.getState().selectJob(job.id);
    fetchJobDetails(job.id);
  };

  return (
    <div className={`job-item ${selected ? 'selected' : ''}`} onClick={handleClick}>
      <div className="job-header">
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.title || job.url || job.original_url || `Job #${job.id}`}
        </div>
        <div className={`status-pill status-${job.status}`}>
          {job.status === 'running' && <span className="indicator"></span>}
          {job.status.toUpperCase()}
        </div>
      </div>
    </div>
  );
};

const JobsList = () => {
  const { jobs, selectedJobId, showArchived, toggleArchived } = useJobStore();
  const allJobs = Object.values(jobs).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeJobs = allJobs.filter(j => !j.archived);
  const archivedJobs = allJobs.filter(j => j.archived);

  return (
    <section className="card" style={{ gridColumn: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Jobs</h2>
        <div>
          <button className="secondary" onClick={toggleArchived}>{showArchived ? '▾' : '▸'}</button>
        </div>
      </div>
      <h3 style={{ color: 'var(--muted)', margin: '0.6rem 0 0.2rem 0' }}>Active</h3>
      <div className="jobs-list monospace">
        {activeJobs.map(j => <JobItem key={j.id} job={j} selected={selectedJobId === j.id} />)}
      </div>

      <div style={{ display: showArchived ? 'block' : 'none', marginTop: '0.8rem' }}>
        <h3 style={{ color: 'var(--muted)', margin: '0.6rem 0 0.2rem 0' }}>Archived</h3>
        <div className="jobs-list monospace">
          {archivedJobs.map(j => <JobItem key={j.id} job={j} selected={selectedJobId === j.id} />)}
        </div>
      </div>
    </section>
  );
};

const TerminalView = ({ jobId }: { jobId: number }) => {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.innerHTML = logBuffers[jobId] || "";
  }, [jobId]);

  useEffect(() => {
    const handleStream = (e: any) => {
      if (e.detail.jobId === jobId && termRef.current) {
        termRef.current.innerHTML = e.detail.html;
      }
    };
    const handleLoaded = (e: any) => {
      if (e.detail.jobId === jobId && termRef.current) {
        termRef.current.innerHTML = logBuffers[jobId] || "";
      }
    };

    window.addEventListener('job-log-stream', handleStream);
    window.addEventListener('job-logs-loaded', handleLoaded);
    return () => {
      window.removeEventListener('job-log-stream', handleStream);
      window.removeEventListener('job-logs-loaded', handleLoaded);
    };
  }, [jobId]);

  return <div ref={termRef} className="terminal-container term-container" />;
};

const SelectedJobPane = () => {
  const { jobs, selectedJobId, consoleCollapsed, toggleConsole, deleteJob } = useJobStore();
  const job = selectedJobId ? jobs[selectedJobId] : null;

  if (!job) return null;

  const title = job.title || job.url || job.original_url || `#${job.id}`;
  const files = job.files || [];

  const handleRetry = () => fetch(`/api/jobs/${job.id}/retry`, { method: 'POST' });
  const handleArchive = () => fetch(`/api/jobs/${job.id}/archive`, { method: 'POST' });
  const handleDelete = () => {
    if (confirm('Delete job? ⚠️ this will also delete the files')) {
      fetch(`/api/jobs/${job.id}/delete`, { method: 'POST' }).then(() => deleteJob(job.id));
    }
  };

  return (
    <section className="card" style={{ gridColumn: '1 / -1', marginTop: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>

      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            {job.status === 'failed' && <button className="secondary" onClick={handleRetry}>Retry</button>}
            {files.length > 0 && (
              <button className="secondary" onClick={() => {
                window.location.href = files.length === 1 
                  ? `/api/jobs/${job.id}/files/${files[0].id}`
                  : `/api/jobs/${job.id}/zip`;
              }}>
                {files.length === 1 ? 'Download' : 'Download ZIP'}
              </button>
            )}
            {job.original_url && <button className="secondary" onClick={() => window.open(job.original_url, '_blank')}>Open original</button>}
            {!job.archived && <button className="secondary" onClick={handleArchive}>Archive</button>}
            <button className="secondary danger" onClick={handleDelete}>Delete</button>
          </div>

          <div className="files-area">
            <div className={`expanded`}>
              <div className="files-list monospace">
                {files.length === 0 ? (
                  <em>No files recorded for this job.</em>
                ) : (
                  files.map(f => (
                    <div key={f.id} className="file-item">
                      <div className="file-name">
                        <a href={`/api/jobs/${job.id}/files/${f.id}`}>{f.path.split('/').pop()}</a>
                        <span style={{ color: 'var(--muted)' }}> ({humanSize(f.size_bytes)})</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(job.has_logs || job.status === 'running') && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--muted)' }}>Logs</h3>
            <button className="secondary" onClick={toggleConsole}>{consoleCollapsed ? 'Expand' : 'Collapse'}</button>
          </div>
          <div className="console-area">
            <div className={consoleCollapsed ? '' : 'expanded'} id="console-inner">
               <div id="log-view" className="monospace">
                 <TerminalView jobId={job.id} />
               </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const App = () => {
  useEffect(() => {
    loadInitialData();
    connectWebSocket();
  }, []);

  return (
    <>
      <Header />
      <main>
        <NewJobForm />
        <JobsList />
        <SelectedJobPane />
      </main>
      <footer>
        <span>One-at-a-time downloads</span>
        <span>Go · WebSocket · SQLite · 90s slime</span>
      </footer>
    </>
  );
};

const appEl = document.getElementById('app');
if (appEl) render(<App />, appEl);
