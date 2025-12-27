import { Job } from '../types';
import { useJobStore } from '../store';
import { fetchJobDetails } from '../api';
import { styled } from 'goober';
import { ListContainer, ListHeader, ListScrollArea } from './common/ListView';

const LayoutWrapper = styled(ListContainer)`
  grid-column: 2;
`;

const List = styled(ListScrollArea)``;
const Header = styled(ListHeader)``;

const SubTitle = styled('h3')``;

const Item = styled('div')<{ selected?: boolean }>`
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  border: 1px solid ${props => props.selected ? 'var(--accent2)' : 'transparent'};
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.selected ? 'var(--card-bg)' : 'rgba(0,0,0,0.015)'};
  ${props => props.selected && 'box-shadow: 0 8px 24px rgba(0,0,0,0.04);'}

  &:hover {
    background: ${props => props.selected ? 'var(--card-bg)' : 'rgba(0,0,0,0.035)'};
  }
`;

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
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

  return (
    <Item className="lt-job-item" selected={selected} onClick={handleClick}>
      <div className="lt-flex-between" style={{ gap: '1.2rem' }}>
        <TitleContainer>
          <TitleText>
            {job.title || job.url || job.original_url || `Job #${job.id}`}
          </TitleText>
        </TitleContainer>
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
    <LayoutWrapper className="lt-card">
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
