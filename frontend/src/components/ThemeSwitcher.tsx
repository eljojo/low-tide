import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { styled } from 'goober';

const THEMES = [
  { id: 'archivist', name: 'The Archivist' },
  { id: 'midnight-vinyl', name: 'Midnight Vinyl' },
  { id: 'the-broadcaster', name: 'The Broadcaster' },
];

export const ThemeSwitcher = () => {
  const [selectedTheme, setSelectedTheme] = useState('archivist');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'archivist';
    setSelectedTheme(savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
  }, []);

  const handleChange = (e: h.JSX.TargetedEvent<HTMLSelectElement, Event>) => {
    const theme = e.currentTarget.value;
    setSelectedTheme(theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  return (
    <Container>
      <label className="lt-label" style={{ margin: 0, fontSize: '0.65rem' }} htmlFor="theme-switcher">
        Surface
      </label>
      <select 
        className="lt-select"
        style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        id="theme-switcher" 
        onChange={handleChange} 
        value={selectedTheme}
      >
        {THEMES.map(theme => (
          <option key={theme.id} value={theme.id}>{theme.name}</option>
        ))}
      </select>
    </Container>
  );
};

const Container = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;
