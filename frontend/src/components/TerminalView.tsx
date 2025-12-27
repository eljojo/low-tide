import { useEffect, useRef } from 'preact/hooks';
import { logBuffers } from '../store';

export const TerminalView = ({ jobId }: { jobId: number }) => {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current) return;
    const existing = logBuffers[jobId] || "";
    if (existing) {
       termRef.current.innerHTML = existing;
    }
  }, [jobId]);

  useEffect(() => {
    const handleStream = (e: any) => {
      if (e.detail.job_id === jobId && termRef.current) {
        const msg = e.detail;
        if (msg.lines) {
          // Line delta update
          for (const [idxStr, htmlLine] of Object.entries(msg.lines)) {
            const idx = parseInt(idxStr);
            let lineDiv = termRef.current.querySelector(`[data-line="${idx}"]`);
            if (lineDiv) {
              lineDiv.outerHTML = htmlLine as string;
            }
          }
        }
      }
    };
    const handleLoaded = (e: any) => {
      if (e.detail.jobId === jobId && termRef.current) {
        termRef.current.innerHTML = logBuffers[jobId] || "";
      }
    };

    window.addEventListener('job-log-stream', handleStream);
    window.addEventListener('job-logs-loaded', handleLoaded);
    return () => {
      window.removeEventListener('job-log-stream', handleStream);
      window.removeEventListener('job-logs-loaded', handleLoaded);
    };
  }, [jobId]);

  return <div ref={termRef} className="terminal-container term-container" />;
};
