import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <label htmlFor="theme-switcher" style={{ 
        fontSize: '0.65rem', 
        textTransform: 'uppercase', 
        margin: 0, 
        color: 'var(--muted)',
        fontWeight: 700,
        letterSpacing: '0.05em'
      }}>
        Surface
      </label>
      <select 
        id="theme-switcher" 
        onChange={handleChange} 
        value={selectedTheme} 
        style={{ 
          fontSize: '0.75rem', 
          background: 'var(--card-bg)', 
          color: 'var(--fg)', 
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          padding: '0.2rem 0.5rem',
          cursor: 'pointer',
          outline: 'none',
          fontFamily: 'inherit'
        }}
      >
        {THEMES.map(theme => (
          <option key={theme.id} value={theme.id}>{theme.name}</option>
        ))}
      </select>
    </div>
  );
};
