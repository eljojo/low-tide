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

interface State {
  jobs: Record<number, Job>;
  selectedJobId: number | null;
  showArchived: boolean;
  consoleCollapsed: boolean;
}

// GIANT OBJECT STATE
const STATE: State = {
  jobs: {}, // Map<id, JobObject>
  selectedJobId: null,
  showArchived: false,
  consoleCollapsed: true,
};

let stateSocket: WebSocket | null = null;

// --- RENDERING ---

function render(): void {
  renderJobsLists();
  renderSelectedJobPane();
}

function renderJobsLists(): void {
  const activeList = document.getElementById('jobs-list');
  const archivedList = document.getElementById('archived-list');
  if (!activeList || !archivedList) return;

  // Convert map to array and sort by created_at desc
  const allJobs = Object.values(STATE.jobs).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  activeList.innerHTML = '';
  archivedList.innerHTML = '';

  allJobs.forEach(job => {
    const el = createJobItem(job);
    if (job.archived) {
      archivedList.appendChild(el);
    } else {
      activeList.appendChild(el);
    }
  });
  
  const archivedSec = document.getElementById('archived-section');
  const toggleBtn = document.getElementById('toggle-archived');
  if (archivedSec && toggleBtn) {
    if (STATE.showArchived) {
      archivedSec.style.display = 'block';
      toggleBtn.textContent = '▾';
    } else {
      archivedSec.style.display = 'none';
      toggleBtn.textContent = '▸';
    }
  }

  // Check for any running jobs to show global indicator
  const isAnyJobRunning = allJobs.some(job => job.status === 'running');
  const globalIndicator = document.getElementById('global-indicator');
  if (globalIndicator) {
    globalIndicator.style.display = isAnyJobRunning ? 'block' : 'none';
  }
}

function createJobItem(job: Job): HTMLElement {
  const div = document.createElement('div');
  div.className = 'job-item';
  if (STATE.selectedJobId === job.id) div.classList.add('selected');
  
  const header = document.createElement('div');
  header.className = 'job-header';
  
  const left = document.createElement('div');
  const title = job.title && job.title !== '' ? job.title : (job.url || job.original_url || 'Job #' + job.id);
  left.innerText = title;
  
  const status = document.createElement('div');
  status.className = 'status-pill status-' + job.status;

  if (job.status === 'running') {
    const indicator = document.createElement('span');
    indicator.className = 'indicator';
    status.appendChild(indicator);
  }
  status.appendChild(document.createTextNode(job.status.toUpperCase()));
  
  header.appendChild(left);
  header.appendChild(status);
  div.appendChild(header);
  
  div.onclick = () => selectJob(job.id);
  
  return div;
}

function renderSelectedJobPane(): void {
  const pane = document.getElementById('files-pane');
  if (!pane) return;

  if (!STATE.selectedJobId) {
    pane.style.display = 'none';
    return;
  }
  const job = STATE.jobs[STATE.selectedJobId];
  if (!job) {
    pane.style.display = 'none';
    return;
  }
  
  pane.style.display = '';
  
  // Header
  const title = job.title && job.title !== '' ? job.title : (job.url || job.original_url || '#' + job.id);
  const titleEl = document.getElementById('files-job-title');
  if (titleEl) titleEl.textContent = title;
  
  // Actions
  updateJobActions(job);
  
  // Files
  renderFilesList(job);
  
  // Logs
  renderLogs(job);

  // Console collapse state
  const consoleInner = document.getElementById('console-inner');
  const toggleBtn = document.getElementById('toggle-console');
  if (consoleInner && toggleBtn) {
    if (STATE.consoleCollapsed) {
        consoleInner.classList.remove('expanded');
        toggleBtn.textContent = 'Expand';
    } else {
        consoleInner.classList.add('expanded');
        toggleBtn.textContent = 'Collapse';
    }
  }
}

function renderFilesList(job: Job): void {
  const el = document.getElementById('files-list');
  const filesAreaInner = document.getElementById('files-area-inner');
  if (!el || !filesAreaInner) return;

  const files = job.files || [];
  
  if (files.length === 0) {
    el.innerHTML = '<em>No files recorded for this job.</em>';
    if (job.status === 'running') {
        filesAreaInner.classList.remove('expanded');
    } else {
        filesAreaInner.classList.add('expanded');
    }
    return;
  }
  
  filesAreaInner.classList.add('expanded');
  el.innerHTML = '';
  
  if (files.length === 1) {
      const f = files[0];
      const row = document.createElement('div'); row.className = 'file-item';
      const left = document.createElement('div'); left.className = 'file-name';
      const basename = f.path.split('/').pop();
      left.innerHTML = `<a href='/api/jobs/${job.id}/files/${f.id}'>${basename}</a> <span style='color:var(--muted)'>(${humanSize(f.size_bytes)})</span>`;
      row.appendChild(left); el.appendChild(row);
      return;
  }
  
  const paths = files.map(f => f.path.split('/').slice(0, -1).join('/')); 
  const firstDir = paths[0];
  const allSameDir = paths.every(p => p === firstDir);
  
  let commonPrefix = '';
  if (allSameDir) {
      commonPrefix = firstDir;
  } else {
      const splitPaths = files.map(f => f.path.split('/').filter(x => x));
      if (splitPaths.length > 0) {
           let prefix = splitPaths[0].slice(0, -1);
           for (let i = 1; i < splitPaths.length; i++) {
               const current = splitPaths[i];
               let j = 0;
               while (j < prefix.length && j < current.length - 1 && prefix[j] === current[j]) {
                   j++;
               }
               prefix = prefix.slice(0, j);
           }
           if (prefix.length > 0) commonPrefix = '/' + prefix.join('/');
      }
  }
  
  let displayPrefix = commonPrefix;
  if (displayPrefix === '/') displayPrefix = '';
  
  if (displayPrefix) {
      const hdr = document.createElement('div');
      hdr.style.fontWeight = '600'; 
      hdr.style.margin = '0.4rem 0 0.2rem 0';
      hdr.textContent = displayPrefix.replace(/^\//, ''); 
      el.appendChild(hdr);
  }
  
  files.forEach(f => {
      const row = document.createElement('div'); 
      row.className = 'file-item';
      if (displayPrefix) {
          row.style.paddingLeft = '1rem';
      }
      
      const left = document.createElement('div'); 
      left.className = 'file-name';
      let displayName = f.path.split('/').pop();
      
      left.innerHTML = `<a href='/api/jobs/${job.id}/files/${f.id}'>${displayName}</a> <span style='color:var(--muted)'>(${humanSize(f.size_bytes)})</span>`;
      row.appendChild(left); 
      el.appendChild(row);
  });
}

function renderLogs(job: Job): void {
    const pre = document.getElementById('log-pre');
    const logView = document.getElementById('log-view');
    if (!pre || !logView) return;
    
    if (!job.logs || job.logs === '') {
        pre.textContent = 'No logs.';
    } else {
        pre.textContent = job.logs;
    }
    
    // Auto-scroll if running
    if (job.status === 'running') {
       logView.scrollTop = logView.scrollHeight;
    }
}

function updateJobActions(job: Job): void {
  const actionDownload = document.getElementById('action-download') as HTMLButtonElement | null;
  const actionRetry = document.getElementById('action-retry') as HTMLButtonElement | null;
  const actionArchive = document.getElementById('action-archive') as HTMLButtonElement | null;
  const openSource = document.getElementById('job-open-source') as HTMLButtonElement | null;
  if (!actionDownload || !actionRetry || !actionArchive || !openSource) return;

  const fileCount = (job.files || []).length;
  
  if (fileCount === 0) {
    actionDownload.style.display = 'none';
  } else if (fileCount === 1) {
    actionDownload.style.display = '';
    actionDownload.textContent = 'Download';
    const f = job.files![0];
    actionDownload.onclick = () => { window.location.href = '/api/jobs/' + job.id + '/files/' + f.id; };
  } else {
    actionDownload.style.display = '';
    actionDownload.textContent = 'Download ZIP';
    actionDownload.onclick = () => { window.location.href = '/api/jobs/' + job.id + '/zip' };
  }
  
  if (job.status === 'failed') actionRetry.style.display = '';
  else actionRetry.style.display = 'none';
  
  if (job.archived) actionArchive.style.display = 'none';
  else actionArchive.style.display = '';
  
  if (job.original_url) {
    openSource.onclick = () => window.open(job.original_url, '_blank');
    openSource.style.display = '';
  } else {
    openSource.style.display = 'none';
  }
}

// --- ACTIONS ---

async function loadInitialData(): Promise<void> {
  try {
      const res = await fetch('/api/jobs');
      const jobs: Job[] = await res.json();
      
      jobs.forEach(j => updateJobState(j));
      
      const runningJob = jobs.find(j => j.status === 'running');
      if (runningJob) {
          selectJob(runningJob.id);
      }
      
      render();
      connectWebSocket();
  } catch (e) {
      console.error('Initial load failed', e);
  }
}

async function selectJob(id: number): Promise<void> {
    if (STATE.selectedJobId === id) return; 
    
    STATE.selectedJobId = id;
    
    const job = STATE.jobs[id];
    if (job && job.status === 'success') {
        STATE.consoleCollapsed = true;
    } else {
        STATE.consoleCollapsed = false;
    }
    
    if (!job) return;

    render();
    await fetchJobDetails(id);
}

async function fetchJobDetails(id: number): Promise<void> {
    try {
        const res = await fetch(`/api/jobs/${id}`);
        if (res.ok) {
            const job: Job = await res.json();
            if (job) {
                updateJobState(job);
            }
        }
    } catch (e) { console.error(e); }
}

function updateJobState(job: Job): void {
    const id = job.id;
    if (!STATE.jobs[id]) {
        STATE.jobs[id] = { ...job, logs: job.logs || "", files: job.files || [] };
    } else {
        STATE.jobs[id] = { ...STATE.jobs[id], ...job };
    }
    
    render();
}

// --- WEBSOCKET ---

function connectWebSocket(): void {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    stateSocket = new WebSocket(proto + '//' + location.host + '/ws/state');
    stateSocket.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            handleWSMessage(msg);
        } catch (e) { console.error(e); }
    };
    stateSocket.onclose = () => setTimeout(connectWebSocket, 2000);
}

function handleWSMessage(msg: any): void {
    if (msg.type === 'job_snapshot') {
        if (msg.job) {
            const oldStatus = STATE.jobs[msg.job.id] ? STATE.jobs[msg.job.id].status : null;
            updateJobState(msg.job);
            
            if (msg.job.id === STATE.selectedJobId) {
                // If transitioning running -> success, collapse console
                if (oldStatus === 'running' && msg.job.status === 'success') {
                    STATE.consoleCollapsed = true;
                    renderSelectedJobPane();
                }
            } else if (msg.job.status === 'running') {
                // If new running job, select it
                selectJob(msg.job.id);
            }
        }
    } else if (msg.type === 'job_log') {
        const job = STATE.jobs[msg.job_id];
        if (job) {
            if (job.logs === undefined || job.logs === null) job.logs = "";
            if (job.logs !== "") job.logs += String.fromCharCode(10); // new line
            job.logs += msg.line;
            
            // Only re-render if this is the selected job
            if (STATE.selectedJobId === msg.job_id) {
                renderLogs(job);
            }
        }
    } else if (msg.type === 'jobs_archived') {
        // Reload everything to be safe
        loadInitialData();
    }
}

// --- EVENT HANDLERS ---

const newJobForm = document.getElementById('new-job-form');
if (newJobForm) {
  newJobForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const target = ev.target as HTMLFormElement;
      const fd = new FormData(target);
      const res = await fetch('/api/jobs', { method: 'POST', body: fd });
      if (res.ok) {
          target.reset();
      }
  });
}

document.getElementById('toggle-archived')?.addEventListener('click', () => {
    STATE.showArchived = !STATE.showArchived;
    render();
});

document.getElementById('toggle-console')?.addEventListener('click', () => {
    STATE.consoleCollapsed = !STATE.consoleCollapsed;
    renderSelectedJobPane(); 
});

document.getElementById('action-retry')?.addEventListener('click', async () => {
    if (!STATE.selectedJobId) return;
    await fetch(`/api/jobs/${STATE.selectedJobId}/retry`, { method: 'POST' });
});

document.getElementById('action-archive')?.addEventListener('click', async () => {
    if (!STATE.selectedJobId) return;
    await fetch(`/api/jobs/${STATE.selectedJobId}/archive`, { method: 'POST' });
});

document.getElementById('action-delete')?.addEventListener('click', async () => {
    if (!STATE.selectedJobId) return;
    if (!confirm('Delete job? ⚠️ this will also delete the files')) return;
    const id = STATE.selectedJobId;
    await fetch(`/api/jobs/${id}/delete`, { method: 'POST' });
    delete STATE.jobs[id];
    STATE.selectedJobId = null;
    render();
});

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

loadInitialData();
