import { Job } from '../types';
import { useJobStore } from '../store';
import { fetchJobDetails } from '../api';

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

export const JobsList = () => {
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
