import { useJobStore } from '../store';

export const Header = () => {
  return (
    <header>
      <div className="blob"></div>
      <a href="/" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
        <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Low Tide</h1>
      </a>
    </header>
  );
};
