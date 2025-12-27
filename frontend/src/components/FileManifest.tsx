import { styled } from 'goober';
import { Job, FileInfo } from '../types';
import { humanSize } from '../utils';
import { TableContainer, TableRow, TableScrollArea, TableFooter } from './common/Table';

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

interface FileManifestProps {
  job: Job;
}

export const FileManifest = ({ job }: FileManifestProps) => {
  const files = job.files || [];
  const { status, id } = job;
  const hasFiles = files.length > 0;
  const isCleaned = status === 'cleaned';

  if (status === 'queued') {
    return (
      <ManifestSection>
        <ManifestPlaceholder>Job hasn't started yet</ManifestPlaceholder>
      </ManifestSection>
    );
  }

  if (!hasFiles && (status === 'running' || status === 'failed')) {
    return null;
  }

  return (
    <ManifestSection>
      <h3 className="lt-title-section">
        Artifact Manifest {hasFiles ? `[${files.length} Item${files.length === 1 ? '' : 's'}]` : ''}
      </h3>

      {!hasFiles ? (
        <ManifestPlaceholder>
          {isCleaned ? 'Files have been cleaned' : 'No files available'}
        </ManifestPlaceholder>
      ) : files.length === 1 ? (
        <FileHero file={files[0]} jobId={id} isCleaned={isCleaned} />
      ) : (
        <FileTable files={files} jobId={id} isCleaned={isCleaned} />
      )}
    </ManifestSection>
  );
};

const FileHero = ({ file, jobId, isCleaned }: { file: FileInfo; jobId: number; isCleaned: boolean }) => (
  <SingleFileHero className="lt-file-hero">
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ fontSize: '2.2rem' }}>📄</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{file.path.split('/').pop()}</div>
        <div className="lt-meta" style={{ marginTop: '0.2rem' }}>{humanSize(file.size_bytes)}</div>
      </div>
    </div>
    {!isCleaned && (
      <button className="lt-btn" onClick={() => window.location.href = `/api/jobs/${jobId}/files/${file.id}`}>
        Download
      </button>
    )}
  </SingleFileHero>
);

const FileTable = ({ files, jobId, isCleaned }: { files: FileInfo[]; jobId: number; isCleaned: boolean }) => (
  <TableContainer className="lt-file-grid">
    <TableRow isHeader className="lt-file-grid-header">
      <div>Name</div>
      <div>Size</div>
      <div className="lt-text-right">Actions</div>
    </TableRow>
    <TableScrollArea className="lt-scrollable">
      {files.map(f => (
        <TableRow key={f.id}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {f.path.split('/').pop()}
          </div>
          <div className="lt-meta">{humanSize(f.size_bytes)}</div>
          <div className="lt-text-right">
            {!isCleaned && (
              <a href={`/api/jobs/${jobId}/files/${f.id}`} style={{ color: 'var(--accent2)', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800 }}>GET</a>
            )}
          </div>
        </TableRow>
      ))}
    </TableScrollArea>
    {!isCleaned && (
      <TableFooter>
        <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={() => window.location.href = `/api/jobs/${jobId}/zip`}>
          Download All
        </button>
      </TableFooter>
    )}
  </TableContainer>
);
