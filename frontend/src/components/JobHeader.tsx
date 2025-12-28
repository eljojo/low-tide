import { styled } from 'goober';
import { Job } from '../types';
import { useJobStore, logBuffers } from '../store';

const PaneHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  position: relative;
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex: 1;
`;

const JobImage = styled('img')`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
`;

const ImagePlaceholder = styled('div')`
  width: 80px;
  height: 80px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  font-size: 0.75rem;
  text-align: center;
  flex-shrink: 0;
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

const RunningIndicator = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  z-index: 10;
`;

const ImageContainer = styled('div')`
  /* Default theme styling - will be overridden by CSS themes */
  display: flex;
  flex-shrink: 0;
`;

const BottomRow = styled('div')`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

interface JobHeaderProps {
  job: Job;
}

export const JobHeader = ({ job }: JobHeaderProps) => {
  const title = job.title || job.url || job.original_url || `#${job.id}`;

  const handleRetry = () => {
    logBuffers[job.id] = '';
    window.dispatchEvent(new CustomEvent('job-logs-loaded', { detail: { jobId: job.id } }));
    fetch(`/api/jobs/${job.id}/retry`, { method: 'POST' });
    useJobStore.getState().setConsoleCollapsed(false);
  };
  const handleCancel = () => fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
  const handleArchive = () => fetch(`/api/jobs/${job.id}/archive`, { method: 'POST' });
  const handleCleanup = () => {
    if (confirm('⚠️ Cleanup files? this will delete the files on disk')) {
      // If we're in an e2e test, we might already be handled by the dialog listener,
      // but this is standard browser confirm.
      fetch(`/api/jobs/${job.id}/cleanup`, { method: 'POST' });
    }
  };
  const handleCleanupNoConfirm = () => {
      fetch(`/api/jobs/${job.id}/cleanup`, { method: 'POST' });
  };
  const files = job.files || [];
  const hasFiles = files.length > 0;

  const getImageUrl = () => {
    if (!job.image_path) return null;
    // Use job ID to fetch thumbnail securely
    return `/thumbnails/${job.id}`;
  };

  const imageUrl = getImageUrl();

  return (
    <PaneHeader>
      <HeaderContent>
        <ImageContainer className="lt-job-image-container">
          {imageUrl ? (
            <JobImage 
              className="lt-job-image"
              src={imageUrl} 
              alt={title}
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <ImagePlaceholder className="lt-job-image-placeholder">
              No Image
            </ImagePlaceholder>
          )}
        </ImageContainer>
        <TitleGroup className="pane-title-group">
          <MainTitleRow>
            <Title>{title}</Title>
          </MainTitleRow>
          <div className="lt-actions-row">
            {job.status === 'running' && (
              <RunningIndicator className="lt-running-indicator lt-action-indicator">
                <span className="lt-indicator-dot"></span>
                Downloading
              </RunningIndicator>
            )}
            {job.original_url && (
              <button className="lt-btn lt-btn-secondary lt-btn-sm lt-action-btn" onClick={() => window.open(job.original_url, '_blank')}>
                Source
              </button>
            )}
            {!job.archived && (job.status == 'success' || job.status == 'failed' || job.status === 'cancelled') && (
              <button className="lt-btn lt-btn-secondary lt-btn-sm lt-action-btn" onClick={handleArchive}>Archive</button>
            )}
            {hasFiles && (job.status == 'success' || job.status == 'failed' || job.status === 'cancelled') && (
              <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm lt-action-btn" onClick={handleCleanup}>Cleanup</button>
            )}
            {job.status === 'running' && <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm lt-action-btn" onClick={handleCancel}>Cancel</button>}
            {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'cleaned') && (
              <button className="lt-btn lt-btn-secondary lt-btn-sm lt-action-btn" onClick={handleRetry}>
                {job.status === 'cleaned' ? 'Download again' : 'Retry'}
              </button>
            )}
          </div>
          <div className="lt-meta" style={{ marginTop: '0.4rem' }}>
            <span>Entry #{job.id} &bull; {new Date(job.created_at).toLocaleString()}</span>
          </div>
        </TitleGroup>
      </HeaderContent>
      <BottomRow className="lt-row">
        {job.original_url && (
          <button className="lt-btn lt-btn-secondary lt-btn-sm lt-bottom-btn" onClick={() => window.open(job.original_url, '_blank')}>
            Source
          </button>
        )}
        {!job.archived && (job.status == 'success' || job.status == 'failed' || job.status === 'cancelled') && (
          <button className="lt-btn lt-btn-secondary lt-btn-sm lt-bottom-btn" onClick={handleArchive}>Archive</button>
        )}
        {hasFiles && (job.status == 'success' || job.status == 'failed' || job.status === 'cancelled') && (
          <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm lt-bottom-btn" onClick={handleCleanup}>Cleanup</button>
        )}
        {job.status === 'running' && <button className="lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm lt-bottom-btn" onClick={handleCancel}>Cancel</button>}
        {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'cleaned') && (
          <button className="lt-btn lt-btn-secondary lt-btn-sm lt-bottom-btn" onClick={handleRetry}>
            {job.status === 'cleaned' ? 'Download again' : 'Retry'}
          </button>
        )}
      </BottomRow>
    </PaneHeader>
  );
};
