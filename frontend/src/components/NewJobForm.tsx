import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { useJobStore } from '../store';

export const NewJobForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const res = await fetch('/api/jobs', { method: 'POST', body: fd });
    if (res.ok) {
      formRef.current.reset();
      const data = await res.json();
      let newId = 0;
      if (data.id) newId = data.id;
      else if (data.ids && data.ids.length > 0) newId = data.ids[0];

      if (newId) {
        useJobStore.getState().selectJob(newId, false); // select and unpin
      }
    }
  };

  return (
    <section className="card">
      <h2>New Download Job</h2>
      <form ref={formRef} onSubmit={handleSubmit}>
        <label htmlFor="app">Downloader</label>
        <select id="app" name="app_id">
          <option value="auto">Auto-detect</option>
          {(window.CONFIG?.apps || []).map(app => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>

        <label htmlFor="urls">URLs (one per line or space-separated)</label>
        <textarea id="urls" name="urls" rows={4} placeholder={`https://example.com/file1.mp3
https://example.com/file2.mp3`}></textarea>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.8rem' }}>
          <button type="submit">Queue Job</button>
        </div>
      </form>
    </section>
  );
};
