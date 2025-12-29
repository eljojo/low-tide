import { render, h, Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { setup as gooberSetup } from 'goober';
import { Router, Route, Switch, useLocation } from 'wouter';
import { connectWebSocket, loadInitialData } from './api';
import { useJobStore } from './store';
import { Header } from './components/Header';
import { NewJobForm } from './components/NewJobForm';
import { JobsList } from './components/JobsList';
import { SelectedJobPane } from './components/SelectedJobPane';
import { Footer } from './components/Footer';

// Initialize goober with Preact's h function
gooberSetup(h);

const App = () => {
  const [location, setLocation] = useLocation();
  const selectJob = useJobStore((state) => state.selectJob);

  useEffect(() => {
    loadInitialData().then((jobs) => {
      // Only auto-select on *initial load* when we're at root AND auto-navigation is enabled.
      // This prevents a frustrating UX where the user can never stay on '/'
      // while a job is running.
      if (window.location.pathname === '/') {
        const state = useJobStore.getState();
        if (state.shouldAutoNavigateToNewJobs) {
          const runningJob = jobs.find(j => j.status === 'running');
          if (runningJob) {
            setLocation(`/job/${runningJob.id}/logs`);
          }
        }
      }
    });
    connectWebSocket();
  }, [setLocation]);

  // Handle unselection when navigating to root
  useEffect(() => {
    if (location === '/') {
      selectJob(null);
    }
  }, [location, selectJob]);

  return (
    <Fragment>
      <Header />
      <main>
        <NewJobForm />
        <JobsList />
        <Switch>
          <Route path="/job/:id/logs">
            {(params) => <SelectedJobPane id={params.id} showLogs={true} />}
          </Route>
          <Route path="/job/:id">
            {(params) => <SelectedJobPane id={params.id} showLogs={false} />}
          </Route>
        </Switch>
      </main>
      <Footer />
    </Fragment>
  );
};

const appEl = document.getElementById('app');
if (appEl) {
  render(
    <Router>
      <App />
    </Router>,
    appEl
  );
}
