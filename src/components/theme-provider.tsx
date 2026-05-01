'use client';

import { useEffect } from 'react';
import { RESOLVED_APPEARANCE, THEMES, type ThemeMode } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';

function isThemeMode(value: string): value is ThemeMode {
  return value in THEMES;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    const activeTheme = isThemeMode(theme) ? theme : 'dark';

    const vars = THEMES[activeTheme];
    const resolvedAppearance = RESOLVED_APPEARANCE[activeTheme];
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    root.style.colorScheme = resolvedAppearance;
    root.dataset.appearance = resolvedAppearance;
    root.dataset.colorTheme = activeTheme;
    root.dataset.resolvedTheme = resolvedAppearance;

    root.classList.toggle('dark', resolvedAppearance === 'dark');
    root.classList.toggle('qc-lite-mode', resolvedAppearance === 'light');
  }, [theme]);

  return <>{children}</>;
}
