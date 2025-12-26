import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
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
  logs?: string;
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
  appendLog: (jobId: number, line: string) => void;
  selectJob: (id: number) => void;
  deleteJob: (id: number) => void;
  toggleArchived: () => void;
  toggleConsole: () => void;
  setConsoleCollapsed: (collapsed: boolean) => void;
}

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

  appendLog: (jobId, line) => set((state) => {
    const job = state.jobs[jobId];
    if (!job) return state;
    const currentLogs = job.logs || "";
    const newLogs = currentLogs + (currentLogs !== "" ? String.fromCharCode(10) : "") + line;
    return {
      jobs: {
        ...state.jobs,
        [jobId]: { ...job, logs: newLogs }
      }
    };
  }),

  selectJob: (id) => set((state) => {
    const job = state.jobs[id];
    let consoleCollapsed = state.consoleCollapsed;
    if (job) {
      consoleCollapsed = job.status === 'success';
    }
    return { selectedJobId: id, consoleCollapsed };
  }),

  deleteJob: (id) => set((state) => {
    const newJobs = { ...state.jobs };
    delete newJobs[id];
    return {
      jobs: newJobs,
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId
    };
  }),

  toggleArchived: () => set((state) => ({ showArchived: !state.showArchived })),
  toggleConsole: () => set((state) => ({ consoleCollapsed: !state.consoleCollapsed })),
  setConsoleCollapsed: (collapsed) => set({ consoleCollapsed: collapsed }),
}));

// --- API ACTIONS ---

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

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(proto + '//' + location.host + '/ws/state');
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'job_snapshot' && msg.job) {
        const oldStatus = useJobStore.getState().jobs[msg.job.id]?.status;
        useJobStore.getState().updateJob(msg.job);
        if (msg.job.id === useJobStore.getState().selectedJobId) {
          if (oldStatus === 'running' && msg.job.status === 'success') {
            useJobStore.getState().setConsoleCollapsed(true);
          }
        } else if (msg.job.status === 'running') {
          useJobStore.getState().selectJob(msg.job.id);
          fetchJobDetails(msg.job.id);
        }
      } else if (msg.type === 'job_log') {
        useJobStore.getState().appendLog(msg.job_id, msg.line);
      } else if (msg.type === 'jobs_archived') {
        loadInitialData();
      }
    } catch (e) { console.error(e); }
  };
  socket.onclose = () => setTimeout(connectWebSocket, 2000);
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

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--muted)' }}>Logs</h3>
          <button className="secondary" onClick={toggleConsole}>{consoleCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        <div className="console-area">
          <div className={consoleCollapsed ? '' : 'expanded'} id="console-inner">
             <div id="log-view" className="monospace">
               <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{job.logs || 'No logs.'}</pre>
             </div>
          </div>
        </div>
      </div>
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
