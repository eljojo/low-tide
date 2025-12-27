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
    <section className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="pane-header">
        <div className="pane-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {job.status === 'running' && <div id="global-indicator"></div>}
            <h2>{title}</h2>
          </div>
          <div className="pane-metadata">
            Entry #{job.id} &bull; {new Date(job.created_at).toLocaleString()}
          </div>
        </div>
        <div className="row">
            {job.original_url && <button className="secondary" onClick={() => window.open(job.original_url, '_blank')}>Source</button>}
            {!job.archived && job.status !== 'running' && job.status !== 'queued' && (
              <button className="secondary" onClick={handleArchive}>Archive</button>
            )}
            {job.status !== 'cleaned' && job.status !== 'running' && job.status !== 'queued' && (
              <button className="secondary danger" onClick={handleCleanup}>Cleanup</button>
            )}
            {job.status === 'running' && <button className="secondary danger" onClick={handleCancel}>Cancel</button>}
            {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'cleaned') && (
              <button className="secondary" onClick={handleRetry}>Retry</button>
            )}
          </div>
      </div>

      <div className="manifest-section" style={{ marginBottom: '2.5rem' }}>
      {(job.status != 'failed') && (
        <h3 className="section-title">
          Artifact Manifest {files.length > 0 ? `[${files.length} Item${files.length === 1 ? '' : 's'}]` : ''}
        </h3>
      )}
        
        {files.length === 0 ? (
          (job.status != 'failed' && job.status != 'running') && (
            <div className="manifest-placeholder">
              <div>
                {job.status === 'cleaned' ? 'Files have been cleaned' : 'No files available'}
              </div>
            </div>
          )
        ) : files.length === 1 ? (
          <div className="single-file-hero">
            <div className="file-info-group">
              <div className="file-icon">📄</div>
              <div>
                <div className="file-name-text">{files[0].path.split('/').pop()}</div>
                <div className="file-meta-text">{humanSize(files[0].size_bytes)}</div>
              </div>
            </div>
            <button onClick={() => window.location.href = `/api/jobs/${job.id}/files/${files[0].id}`}>
              Download
            </button>
          </div>
        ) : (
          <div className="multi-file-grid">
            <div className="file-grid-header">
              <div>Name</div>
              <div>Size</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            <div className="file-grid-body">
              {files.map(f => (
                <div key={f.id} className="file-row">
                  <div className="file-row-name">
                    {f.path.split('/').pop()}
                  </div>
                  <div className="file-row-size">{humanSize(f.size_bytes)}</div>
                  <div className="file-row-action">
                    <a href={`/api/jobs/${job.id}/files/${f.id}`}>GET</a>
                  </div>
                </div>
              ))}
            </div>
            <div className="file-grid-footer">
               <button className="secondary" style={{ fontSize: '0.65rem' }} onClick={() => window.location.href = `/api/jobs/${job.id}/zip`}>
                 Download all as ZIP
               </button>
            </div>
          </div>
        )}
      </div>

      {(job.status !== 'queued') && (
        <div className="logs-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ marginBottom: 0, border: 'none', padding: 0 }}>LOGS</h3>
      {(job.status !== 'failed') && (
            <button className="secondary" style={{ fontSize: '0.65rem', padding: '0.3rem 0.75rem' }} onClick={toggleConsole}>
              {consoleCollapsed ? 'SHOW LOGS' : 'HIDE LOGS'}
            </button>
      )}
          </div>
          <div className="console-area">
            <div className={consoleCollapsed ? '' : 'expanded'} id="console-inner" style={{ transition: 'none' }}>
               <div id="log-view" className="monospace" style={{ height: consoleCollapsed ? '0px' : '400px', padding: consoleCollapsed ? '0' : '1.5rem', border: consoleCollapsed ? 'none' : '1px solid var(--border-color)' }}>
                 <TerminalView jobId={job.id} />
               </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
