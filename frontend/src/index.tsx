import { render, h, Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { connectWebSocket, loadInitialData } from './api';
import { Header } from './components/Header';
import { NewJobForm } from './components/NewJobForm';
import { JobsList } from './components/JobsList';
import { SelectedJobPane } from './components/SelectedJobPane';
import { Footer } from './components/Footer';

const App = () => {
  useEffect(() => {
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
