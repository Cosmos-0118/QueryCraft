'use client';

import { useEffect } from 'react';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';

const THEMES: Record<ThemeMode, Record<string, string>> = {
  light: {
    '--background': '#ffffff',
    '--foreground': '#0f172a',
    '--muted': '#f8fafc',
    '--muted-foreground': '#64748b',
    '--primary': '#0f172a',
    '--primary-foreground': '#ffffff',
    '--secondary': '#f1f5f9',
    '--secondary-foreground': '#334155',
    '--accent': '#3b82f6',
    '--accent-foreground': '#ffffff',
    '--border': '#e2e8f0',
    '--card': '#ffffff',
    '--card-foreground': '#0f172a',
    '--ring': '#94a3b8',
  },
  dark: {
    '--background': '#09090b',
    '--foreground': '#fafafa',
    '--muted': '#18181b',
    '--muted-foreground': '#a1a1aa',
    '--primary': '#fafafa',
    '--primary-foreground': '#09090b',
    '--secondary': '#27272a',
    '--secondary-foreground': '#fafafa',
    '--accent': '#3b82f6',
    '--accent-foreground': '#ffffff',
    '--border': '#27272a',
    '--card': '#09090b',
    '--card-foreground': '#fafafa',
    '--ring': '#3f3f46',
  },
  signature: {
    '--background': '#050810',
    '--foreground': '#f1f5f9',
    '--muted': '#0d1323',
    '--muted-foreground': '#8ba1c6',
    '--primary': '#2dd4bf', // teal-400
    '--primary-foreground': '#042f2e',
    '--secondary': '#162035',
    '--secondary-foreground': '#e2e8f0',
    '--accent': '#38bdf8', // sky-400
    '--accent-foreground': '#0c4a6e',
    '--border': '#1e293b',
    '--card': '#0a0e17',
    '--card-foreground': '#f1f5f9',
    '--ring': '#2dd4bf',
  },
  crimson: {
    '--background': '#110507',
    '--foreground': '#fee2e2',
    '--muted': '#240a10',
    '--muted-foreground': '#fca5a5',
    '--primary': '#e11d48', // rose-600
    '--primary-foreground': '#fff1f2',
    '--secondary': '#3f1019',
    '--secondary-foreground': '#fecdd3',
    '--accent': '#fb7185', // rose-400
    '--accent-foreground': '#4c0519',
    '--border': '#501421',
    '--card': '#1a080b',
    '--card-foreground': '#fee2e2',
    '--ring': '#e11d48',
  },
  aurora: {
    '--background': '#021012',
    '--foreground': '#ccfbf1',
    '--muted': '#062529',
    '--muted-foreground': '#5eead4',
    '--primary': '#14b8a6', // teal-500
    '--primary-foreground': '#042f2e',
    '--secondary': '#0d3b41',
    '--secondary-foreground': '#99f6e4',
    '--accent': '#10b981', // emerald-500
    '--accent-foreground': '#022c22',
    '--border': '#115e59',
    '--card': '#04181a',
    '--card-foreground': '#ccfbf1',
    '--ring': '#14b8a6',
  },
  'electric-night': {
    '--background': '#090416',
    '--foreground': '#e0e7ff',
    '--muted': '#150a30',
    '--muted-foreground': '#a5b4fc',
    '--primary': '#8b5cf6', // violet-500
    '--primary-foreground': '#f5f3ff',
    '--secondary': '#2e1065',
    '--secondary-foreground': '#ddd6fe',
    '--accent': '#ec4899', // pink-500
    '--accent-foreground': '#fdf2f8',
    '--border': '#3b0764',
    '--card': '#0c0520',
    '--card-foreground': '#e0e7ff',
    '--ring': '#8b5cf6',
  },
};

const RESOLVED_APPEARANCE: Record<ThemeMode, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  signature: 'dark',
  crimson: 'dark',
  aurora: 'dark',
  'electric-night': 'dark',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    const vars = THEMES[theme];
    const resolvedAppearance = RESOLVED_APPEARANCE[theme];
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    root.style.colorScheme = resolvedAppearance;
    root.dataset.appearance = resolvedAppearance;
    root.dataset.colorTheme = theme;
    root.dataset.resolvedTheme = resolvedAppearance;

    root.classList.toggle('dark', resolvedAppearance === 'dark');
    root.classList.toggle('qc-lite-mode', resolvedAppearance === 'light');
  }, [theme]);

  return <>{children}</>;
}
