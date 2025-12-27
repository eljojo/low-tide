import { styled } from 'goober';
import { Job } from '../types';
import { useJobStore } from '../store';

const PaneHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

interface JobHeaderProps {
  job: Job;
}

export const JobHeader = ({ job }: JobHeaderProps) => {
  const title = job.title || job.url || job.original_url || `#${job.id}`;

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
    <PaneHeader>
      <TitleGroup className="pane-title-group">
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
  );
};
