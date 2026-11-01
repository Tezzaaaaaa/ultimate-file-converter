import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'convert-theme';

function systemIsDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemIsDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? 'dark';
  });

  React.useEffect(() => {
    apply(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
