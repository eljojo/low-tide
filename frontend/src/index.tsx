import { render, h, Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { setup as gooberSetup } from 'goober';
import { connectWebSocket, loadInitialData } from './api';
import { useJobStore } from './store';
import { Header } from './components/Header';
import { NewJobForm } from './components/NewJobForm';
import { JobsList } from './components/JobsList';
import { SelectedJobPane } from './components/SelectedJobPane';
import { Footer } from './components/Footer';
import * as api from './api';

// Initialize goober with Preact's h function
gooberSetup(h);

const App = () => {
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/job\/(\d+)(?:\/logs)?$/);

    if (match) {
      const jobId = parseInt(match[1], 10);
      const showLogs = path.endsWith('/logs');

      const state = useJobStore.getState();
      api.fetchJobDetails(jobId);
      state.selectJob(jobId, true);
      if (showLogs) {
        state.setConsoleCollapsed(false);
      } else {
        state.setConsoleCollapsed(true);
      }
    }

    loadInitialData();
    connectWebSocket();
  }, []);

  return (
    <Fragment>
      <Header />
      <main>
        <NewJobForm />
        <JobsList />
        <SelectedJobPane />
      </main>
      <Footer />
    </Fragment>
  );
};

const appEl = document.getElementById('app');
if (appEl) render(<App />, appEl);
