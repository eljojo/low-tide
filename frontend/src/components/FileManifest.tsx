import { styled } from 'goober';
import { Job, FileRecord } from '../types';
import { humanSize } from '../utils';

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

interface FileManifestProps {
  job: Job;
}

export const FileManifest = ({ job }: FileManifestProps) => {
  const files = job.files || [];
  const isCleaned = job.status === 'cleaned';
  const hasFiles = files.length > 0;

  return (
    <ManifestSection>
      {job.status !== 'failed' && (
        <h3 className="lt-title-section">
          Artifact Manifest {hasFiles ? `[${files.length} Item${files.length === 1 ? '' : 's'}]` : ''}
        </h3>
      )}
      
      {!hasFiles ? (
        (job.status !== 'failed' && job.status !== 'running') && (
          <ManifestPlaceholder>
            {isCleaned ? 'Files have been cleaned' : 'No files available'}
          </ManifestPlaceholder>
        )
      ) : files.length === 1 ? (
        <SingleFileHero className="lt-file-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ fontSize: '2.2rem' }}>📄</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{files[0].path.split('/').pop()}</div>
              <div className="lt-meta" style={{ marginTop: '0.2rem' }}>{humanSize(files[0].size_bytes)}</div>
            </div>
          </div>
          {!isCleaned && (
            <button className="lt-btn" onClick={() => window.location.href = `/api/jobs/${job.id}/files/${files[0].id}`}>
              Download
            </button>
          )}
        </SingleFileHero>
      ) : (
        <MultiFileGrid className="lt-file-grid">
          <GridRow isHeader className="lt-file-grid-header">
            <div>Name</div>
            <div>Size</div>
            <div className="lt-text-right">Actions</div>
          </GridRow>
          <div className="lt-scrollable" style={{ maxHeight: '320px' }}>
            {files.map(f => (
              <GridRow key={f.id}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {f.path.split('/').pop()}
                </div>
                <div className="lt-meta">{humanSize(f.size_bytes)}</div>
                <div className="lt-text-right">
                  {!isCleaned && (
                    <a href={`/api/jobs/${job.id}/files/${f.id}`} style={{ color: 'var(--accent2)', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800 }}>GET</a>
                  )}
                </div>
              </GridRow>
            ))}
          </div>
          {!isCleaned && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
               <button className="lt-btn lt-btn-secondary lt-btn-sm" onClick={() => window.location.href = `/api/jobs/${job.id}/zip`}>
                 Download all as ZIP
               </button>
            </div>
          )}
        </MultiFileGrid>
      )}
    </ManifestSection>
  );
};
