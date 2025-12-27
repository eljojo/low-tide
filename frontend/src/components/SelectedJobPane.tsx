import { useJobStore } from '../store';
import { humanSize } from '../utils';
import { TerminalView } from './TerminalView';
import { styled } from 'goober';

const LayoutWrapper = styled('section')`
  grid-column: 1 / -1;
`;

const PaneHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
`;

const TitleGroup = styled('div')`
  display: flex;
  flex-direction: column;
`;

const MainTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.8rem;
`;

const Title = styled('h2')`
  font-size: 1.8rem;
  color: var(--fg);
  letter-spacing: -0.02em;
  text-transform: none;
  margin: 0;
  font-weight: 800;
`;

const ManifestSection = styled('section')`
  margin-bottom: 2.5rem;
`;

const ManifestPlaceholder = styled('div')`
  padding: 1rem;
  text-align: center;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px dashed var(--border-color);
  color: var(--muted);
`;

const SingleFileHero = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.75rem;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`;

const MultiFileGrid = styled('div')`
  overflow: hidden;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`;

const GridRow = styled('div')<{ isHeader?: boolean }>`
  display: grid;
  grid-template-columns: 1fr 120px 100px;
  align-items: center;
  padding: ${props => props.isHeader ? '0.8rem 1.25rem' : '0.9rem 1.25rem'};
  font-size: ${props => props.isHeader ? '0.7rem' : '0.9rem'};
  text-transform: ${props => props.isHeader ? 'uppercase' : 'none'};
  font-weight: ${props => props.isHeader ? '800' : 'normal'};
  color: ${props => props.isHeader ? 'var(--muted)' : 'inherit'};
  background: ${props => props.isHeader ? 'rgba(0,0,0,0.02)' : 'transparent'};
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;

  ${props => !props.isHeader && `
    &:hover { background: rgba(0,0,0,0.02); }
    &:last-child { border-bottom: none; }
  `}
`;

const LogsSection = styled('section')`
  margin-top: 2rem;
`;

const LogsHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LogView = styled('div')<{ collapsed: boolean }>`
  background: var(--term-bg);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  overflow: auto;
  color: var(--term-fg);
  line-height: 1.6;
  font-family: var(--font-mono);
  transition: all 0.3s ease-in-out;
  border: ${props => props.collapsed ? 'none' : '1px solid var(--border-color)'};
  height: ${props => props.collapsed ? '0' : '400px'};
  padding: ${props => props.collapsed ? '0' : '1.5rem'};
`;

export const SelectedJobPane = () => {
  const { jobs, selectedJobId, consoleCollapsed, toggleConsole } = useJobStore();
  const job = selectedJobId ? jobs[selectedJobId] : null;

  if (!job) return null;

  const title = job.title || job.url || job.original_url || `#${job.id}`;
  const files = job.files || [];

  const handleRetry = () => {
    fetch(`/api/jobs/${job.id}/retry`, { method: 'POST' });
    useJobStore.getState().setConsoleCollapsed(false);
  };
  const handleCancel = () => fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
  const handleArchive = () => fetch(`/api/jobs/${job.id}/archive`, { method: 'POST' });
  const handleCleanup = () => {
    if (confirm('⚠️  Cleanup files? this will delete the files on disk')) {
      fetch(`/api/jobs/${job.id}/cleanup`, { method: 'POST' });
    }
  };

  return (
    <LayoutWrapper className="lt-card">
      <PaneHeader>
        <TitleGroup>
          <MainTitleRow>
            {job.status === 'running' && <span className="lt-indicator-dot" style={{ width: '12px', height: '12px' }}></span>}
            <Title>{title}</Title>
          </MainTitleRow>
          <div className="lt-meta" style={{ marginTop: '0.4rem' }}>
            Entry #{job.id} &bull; {new Date(job.created_at).toLocaleString()}
          </div>
        </TitleGroup>
        <div className="lt-row">
          {job.original_url && (
            <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={() => window.open(job.original_url, '_blank')}>
              Source
            </button>
          )}
          {!job.archived && job.status !== 'running' && job.status !== 'queued' && (
            <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={handleArchive}>Archive</button>
          )}
          {job.status !== 'cleaned' && job.status !== 'running' && job.status !== 'queued' && (
            <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm" onClick={handleCleanup}>Cleanup</button>
          )}
          {job.status === 'running' && <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm" onClick={handleCancel}>Cancel</button>}
          {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'cleaned') && (
            <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={handleRetry}>
              {job.status === 'cleaned' ? 'Download again' : 'Retry'}
            </button>
          )}
        </div>
      </PaneHeader>

      <ManifestSection>
        {job.status !== 'failed' && (
          <h3 className="lt-title-section">
            Artifact Manifest {files.length > 0 ? `[${files.length} Item${files.length === 1 ? '' : 's'}]` : ''}
          </h3>
        )}
        
        {files.length === 0 ? (
          (job.status !== 'failed' && job.status !== 'running') && (
            <ManifestPlaceholder>
              {job.status === 'cleaned' ? 'Files have been cleaned' : 'No files available'}
            </ManifestPlaceholder>
          )
        ) : files.length === 1 ? (
          <SingleFileHero>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ fontSize: '2.2rem' }}>📄</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{files[0].path.split('/').pop()}</div>
                <div className="lt-meta" style={{ marginTop: '0.2rem' }}>{humanSize(files[0].size_bytes)}</div>
              </div>
            </div>
            {job.status !== 'cleaned' && (
              <button className="lt-btn" onClick={() => window.location.href = `/api/jobs/${job.id}/files/${files[0].id}`}>
                Download
              </button>
            )}
          </SingleFileHero>
        ) : (
          <MultiFileGrid>
            <GridRow isHeader>
              <div>Name</div>
              <div>Size</div>
              <div className="lt-text-right">Actions</div>
            </GridRow>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {files.map(f => (
                <GridRow key={f.id}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {f.path.split('/').pop()}
                  </div>
                  <div className="lt-meta">{humanSize(f.size_bytes)}</div>
                  <div className="lt-text-right">
                    {job.status !== 'cleaned' && (
                      <a href={`/api/jobs/${job.id}/files/${f.id}`} style={{ color: 'var(--accent2)', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800 }}>GET</a>
                    )}
                  </div>
                </GridRow>
              ))}
            </div>
            {job.status !== 'cleaned' && (
              <div style={{ padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                 <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={() => window.location.href = `/api/jobs/${job.id}/zip`}>
                   Download all as ZIP
                 </button>
              </div>
            )}
          </MultiFileGrid>
        )}
      </ManifestSection>

      {job.status !== 'queued' && (
        <LogsSection>
          <LogsHeader className="lt-flex-between">
            <h3 className="lt-title-section" style={{ border: 'none' }}>LOGS</h3>
            {job.status !== 'failed' && (
              <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={toggleConsole}>
                {consoleCollapsed ? 'SHOW LOGS' : 'CLOSE LOGS'}
              </button>
            )}
          </LogsHeader>
          <LogView collapsed={consoleCollapsed} className="lt-mono">
             <TerminalView jobId={job.id} />
          </LogView>
        </LogsSection>
      )}
    </LayoutWrapper>
  );
};
