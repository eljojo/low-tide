import { Job } from '../types';
import { useJobStore } from '../store';
import { fetchJobDetails } from '../api';
import { styled } from 'goober';
import { ListContainer, ListHeader, ListScrollArea } from './common/ListView';
import { Item } from './common/Item';

const LayoutWrapper = styled(ListContainer)`
  grid-column: 2;
`;

const List = styled(ListScrollArea)``;
const Header = styled(ListHeader)``;

const SubTitle = styled('h3')``;

const JobItemContent = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  overflow: hidden;
`;

const JobThumbnail = styled('img')`
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
`;

const ThumbnailPlaceholder = styled('div')`
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  flex-shrink: 0;
`;

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
  flex: 1;
`;

const TitleText = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const JobItem = ({ job, selected }: { job: Job, selected: boolean }) => {
  const handleClick = () => {
    if (selected) {
      useJobStore.getState().selectJob(null);
    } else {
      useJobStore.getState().selectJob(job.id);
      fetchJobDetails(job.id);
    }
  };

  const getImageUrl = () => {
    if (!job.image_path) return null;
    return `/thumbnails/${job.id}`;
  };

  const imageUrl = getImageUrl();
  const title = job.title || job.url || job.original_url || `Job #${job.id}`;

  return (
    <Item className="lt-job-item" selected={selected} onClick={handleClick}>
      <div className="lt-flex-between" style={{ gap: '1.2rem' }}>
        <JobItemContent>
          {imageUrl ? (
            <JobThumbnail 
              src={imageUrl} 
              alt={title}
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <ThumbnailPlaceholder />
          )}
          <TitleContainer>
            <TitleText>
              {title}
            </TitleText>
          </TitleContainer>
        </JobItemContent>
        <div className={`lt-pill lt-pill-${job.status}`}>
          {job.status === 'running' && <span className="lt-indicator-dot"></span>}
          {job.status.toUpperCase()}
        </div>
      </div>
    </Item>
  );
};

export const JobsList = () => {
  const { jobs, selectedJobId, showArchived, toggleArchived } = useJobStore();
  const allJobs = Object.values(jobs).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeJobs = allJobs.filter(j => !j.archived);
  const archivedJobs = allJobs.filter(j => j.archived);

  return (
    <LayoutWrapper className="lt-card lt-jobs-list">
      <Header>
        <h2 className="lt-title-section" style={{ border: 'none' }}>Jobs</h2>
        {archivedJobs.length > 0 && (
          <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={toggleArchived}>
            {showArchived ? '▾' : '▸'}
          </button>
        )}
      </Header>

      <List className="lt-mono">
        <SubTitle className="lt-label">Active</SubTitle>
        {activeJobs.map(j => <JobItem key={j.id} job={j} selected={selectedJobId === j.id} />)}

        {showArchived && (
          <section style={{ marginTop: '1.5rem' }}>
            <SubTitle className="lt-label">Archived</SubTitle>
            {archivedJobs.map(j => <JobItem key={j.id} job={j} selected={selectedJobId === j.id} />)}
          </section>
        )}
      </List>
    </LayoutWrapper>
  );
};
