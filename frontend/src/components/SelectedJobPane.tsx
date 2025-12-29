import { useEffect } from 'preact/hooks';
import { useLocation } from 'wouter';
import { useJobStore, logBuffers } from '../store';
import { fetchJobDetails, fetchJobLogs } from '../api';
import { TerminalView } from './TerminalView';
import { styled } from 'goober';
import { FileManifest } from './FileManifest';
import { JobHeader } from './JobHeader';

const LayoutWrapper = styled('section')`
  grid-column: 1 / -1;
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
  border: ${props => props.collapsed ? 'none !important' : '1px solid var(--border-color)'};
  height: ${props => props.collapsed ? '0' : '400px'};
  padding: ${props => props.collapsed ? '0' : '1.5rem'};
  margin-top: ${props => props.collapsed ? '0' : '1rem'};
`;

export const SelectedJobPane = ({ id, showLogs }: { id: string, showLogs?: boolean }) => {
  const [, setLocation] = useLocation();
  const { jobs, selectJob } = useJobStore();
  const jobId = parseInt(id, 10);
  const job = jobs[jobId];

  useEffect(() => {
    if (!isNaN(jobId)) {
        selectJob(jobId);

        // Ensure data is fetched
        fetchJobDetails(jobId);
    }
  }, [jobId, selectJob]);

  // Fetch logs when job is selected or when job finishes (to get complete logs)
  useEffect(() => {
    if (!isNaN(jobId) && job) {
        // Fetch logs if: no logs cached, OR job is running (streaming), OR job just finished
        const isTerminal = job.status === 'success' || job.status === 'failed' || job.status === 'cleaned';
        if (!logBuffers[jobId] || job.status === 'running' || isTerminal) {
            fetchJobLogs(jobId);
        }
    }
  }, [jobId, job?.status]);

  if (!job) return null;

  const toggleLogs = () => {
    setLocation(showLogs ? `/job/${jobId}` : `/job/${jobId}/logs`);
  };

  return (
    <LayoutWrapper className="lt-card lt-selected-job-pane">
      <JobHeader job={job} />
      <FileManifest job={job} />

      {job.status !== 'queued' && (
        <LogsSection>
          <LogsHeader className="lt-flex-between">
            <h3 className="lt-title-section" style={{ border: 'none' }}>LOGS</h3>
            {job.status !== 'failed' && (
              <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={toggleLogs}>
                {showLogs ? 'CLOSE LOGS' : 'SHOW LOGS'}
              </button>
            )}
          </LogsHeader>
          <LogView collapsed={!showLogs} className="lt-log-view">
             <TerminalView jobId={job.id} />
          </LogView>
        </LogsSection>
      )}
    </LayoutWrapper>
  );
};
