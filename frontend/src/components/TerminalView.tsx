import { useEffect, useRef } from 'preact/hooks';
import { logBuffers } from '../store';

export const TerminalView = ({ jobId }: { jobId: number }) => {
  const termRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () => {
    const parent = termRef.current?.parentElement;
    if (parent) {
      parent.scrollTop = parent.scrollHeight;
    }
  };

  const isAtBottom = () => {
    const parent = termRef.current?.parentElement;
    if (!parent) return false;
    // Threshold of 50px to be safe with padding
    return (parent.scrollHeight - parent.scrollTop - parent.clientHeight) < 50;
  };

  useEffect(() => {
    if (!termRef.current) return;
    const existing = logBuffers[jobId] || "";
    if (existing) {
       termRef.current.innerHTML = existing;
       scrollBottom();
    }
  }, [jobId]);

  useEffect(() => {
    const handleStream = (e: any) => {
      if (e.detail.job_id === jobId && termRef.current) {
        const msg = e.detail;
        // Streams carry “delta lines”: a map of { lineIndex: htmlString }.
        if (msg.lines) {
          const wasAtBottom = isAtBottom();

          // For each line in the delta:
          // - If the line already exists in the DOM, replace it (outerHTML).
          // - If it doesn’t exist (common after a retry that cleared the buffer),
          //   append it to the end so the terminal shows new output immediately.
          for (const [idxStr, htmlLine] of Object.entries(msg.lines)) {
            const idx = parseInt(idxStr);
            let lineDiv = termRef.current.querySelector(`[data-line="${idx}"]`);
            if (lineDiv) {
              lineDiv.outerHTML = htmlLine as string;
            } else {
              termRef.current.insertAdjacentHTML('beforeend', htmlLine as string);
            }
          }

          // Keep the non-reactive cache aligned with the live DOM so
          // reselecting the job shows the same content without a refetch.
          logBuffers[jobId] = termRef.current.innerHTML;

          if (wasAtBottom) {
            scrollBottom();
          }
        }
      }
    };
    const handleLoaded = (e: any) => {
      if (e.detail.jobId === jobId && termRef.current) {
        termRef.current.innerHTML = logBuffers[jobId] || "";
        scrollBottom();
      }
    };

    window.addEventListener('job-log-stream', handleStream);
    window.addEventListener('job-logs-loaded', handleLoaded);
    return () => {
      window.removeEventListener('job-log-stream', handleStream);
      window.removeEventListener('job-logs-loaded', handleLoaded);
    };
  }, [jobId]);

  return <div ref={termRef} className="lt-terminal" />;
};
