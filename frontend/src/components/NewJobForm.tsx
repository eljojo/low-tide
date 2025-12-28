import { useRef } from 'preact/hooks';
import { useLocation } from 'wouter';
import { styled } from 'goober';
import { useJobStore } from '../store';

const LayoutWrapper = styled('section')`
  grid-column: 1;
`;

const Title = styled('h2')`
  margin: 0;
  border: none;
  padding: 0;
`;

const FieldWrapper = styled('div')`
  margin-bottom: 1.5rem;
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

export const NewJobForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const res = await fetch('/api/jobs', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      formRef.current.reset();
      const job = await res.json();
      let targetId = 0;
      if (job.ids && job.ids.length > 0) {
        targetId = job.ids[0];
      }
      
      if (targetId) {
        setLocation(`/job/${targetId}`);
      }
    }
  };

  return (
    <LayoutWrapper className="lt-card new-job-card">
      <Title className="lt-title-section" style={{ border: 'none' }}>New Download Job</Title>
      <form ref={formRef} onSubmit={handleSubmit}>
        <FieldWrapper>
          <label className="lt-label" htmlFor="app">Downloader</label>
          <select className="lt-select" id="app" name="app_id">
            <option value="auto">Auto-detect</option>
            {(window as any).CONFIG?.apps?.map((app: any) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        </FieldWrapper>

        <FieldWrapper>
          <label className="lt-label" htmlFor="urls">URLs (one per line or space-separated)</label>
          <textarea 
            className="lt-textarea"
            id="urls" 
            name="urls" 
            rows={4} 
            placeholder={`https://example.com/file1.mp3
https://example.com/file2.mp3`} 
          />
        </FieldWrapper>

        <Actions>
          <button className="lt-btn" type="submit">Queue Job</button>
        </Actions>
      </form>
    </LayoutWrapper>
  );
};
