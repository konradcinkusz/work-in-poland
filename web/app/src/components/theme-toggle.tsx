'use client';

import { useLayoutEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
      } else {
        setTheme(null);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next);
    } catch {
      // storage quota exceeded or unavailable
    }
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };

  if (theme === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-secondary btn-sm"
      title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
      aria-label={theme === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
