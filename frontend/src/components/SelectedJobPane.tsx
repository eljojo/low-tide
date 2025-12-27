import { h } from 'preact';
import { useJobStore } from '../store';
import { humanSize } from '../utils';
import { TerminalView } from './TerminalView';

export const SelectedJobPane = () => {
  const { jobs, selectedJobId, consoleCollapsed, toggleConsole } = useJobStore();
  const job = selectedJobId ? jobs[selectedJobId] : null;

  if (!job) return null;

  const title = job.title || job.url || job.original_url || `#${job.id}`;
  const files = job.files || [];

  const handleRetry = () => fetch(`/api/jobs/${job.id}/retry`, { method: 'POST' });
  const handleCancel = () => fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
  const handleArchive = () => fetch(`/api/jobs/${job.id}/archive`, { method: 'POST' });
  const handleCleanup = () => {
    if (confirm('⚠️  Cleanup files? this will delete the files on disk')) {
      fetch(`/api/jobs/${job.id}/cleanup`, { method: 'POST' });
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
            {files.length > 0 && job.status !== 'cleaned' && (
              <button className="secondary" onClick={() => {
                window.location.href = files.length === 1 
                  ? `/api/jobs/${job.id}/files/${files[0].id}`
                  : `/api/jobs/${job.id}/zip`;
              }}>
                {files.length === 1 ? 'Download' : 'Download ZIP'}
              </button>
            )}
            {job.original_url && <button className="secondary" onClick={() => window.open(job.original_url, '_blank')}>Open original</button>}
            {!job.archived && job.status !== 'running' && job.status !== 'queued' && (
              <button className="secondary" onClick={handleArchive}>Archive</button>
            )}
            {job.status !== 'cleaned' && job.status !== 'running' && job.status !== 'queued' && (
              <button className="secondary danger" onClick={handleCleanup}>Cleanup Files</button>
            )}
            {job.status === 'running' && <button className="secondary danger" onClick={handleCancel}>Cancel</button>}
            {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'cleaned') && (
              <button className="secondary" onClick={handleRetry}>Retry</button>
            )}
          </div>

          <div className="files-area">
            <div className={`expanded`}>
              <div className="files-list monospace">
                {files.length === 0 ? (
                  job.status !== 'queued' && job.status !== 'running' && <em>No files recorded for this job.</em>
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

      {(job.status !== 'queued') && (
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
