import { useJobStore } from '../store';
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
  border: ${props => props.collapsed ? 'none' : '1px solid var(--border-color)'};
  height: ${props => props.collapsed ? '0' : '400px'};
  padding: ${props => props.collapsed ? '0' : '1.5rem'};
  margin-top: ${props => props.collapsed ? '0' : '1rem'};
`;

export const SelectedJobPane = () => {
  const { jobs, selectedJobId, consoleCollapsed, toggleConsole } = useJobStore();
  const job = selectedJobId ? jobs[selectedJobId] : null;

  if (!job) return null;

  return (
    <LayoutWrapper className="lt-card">
      <JobHeader job={job} />
      <FileManifest job={job} />

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
          <LogView collapsed={consoleCollapsed} className="lt-mono lt-log-view">
             <TerminalView jobId={job.id} />
          </LogView>
        </LogsSection>
      )}
    </LayoutWrapper>
  );
};
