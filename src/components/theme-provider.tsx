'use client';

import { useEffect } from 'react';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';

const THEMES: Record<ThemeMode, Record<string, string>> = {
  light: {
    '--background': '#ffffff',
    '--foreground': '#111827',
    '--muted': '#f3f4f6',
    '--muted-foreground': '#6b7280',
    '--primary': '#374151',
    '--primary-foreground': '#f9fafb',
    '--secondary': '#e5e7eb',
    '--secondary-foreground': '#1f2937',
    '--accent': '#4b5563',
    '--accent-foreground': '#ffffff',
    '--border': '#d1d5db',
    '--card': '#ffffff',
    '--card-foreground': '#111827',
    '--ring': '#6b7280',
  },
  dark: {
    '--background': '#0b1120',
    '--foreground': '#e2e8f0',
    '--muted': '#1e293b',
    '--muted-foreground': '#94a3b8',
    '--primary': '#38bdf8',
    '--primary-foreground': '#0c1525',
    '--secondary': '#1e293b',
    '--secondary-foreground': '#e2e8f0',
    '--accent': '#0ea5e9',
    '--accent-foreground': '#0b1120',
    '--border': '#334155',
    '--card': '#0f172a',
    '--card-foreground': '#e2e8f0',
    '--ring': '#38bdf8',
  },
  signature: {
    '--background': '#14121f',
    '--foreground': '#f4f1ff',
    '--muted': '#231f36',
    '--muted-foreground': '#b9b0d6',
    '--primary': '#7c6cff',
    '--primary-foreground': '#f5f4ff',
    '--secondary': '#2b2341',
    '--secondary-foreground': '#e7e2ff',
    '--accent': '#b28cff',
    '--accent-foreground': '#190f32',
    '--border': '#3a2f57',
    '--card': '#1a1730',
    '--card-foreground': '#f4f1ff',
    '--ring': '#7c6cff',
  },
  crimson: {
    '--background': '#15090b',
    '--foreground': '#ffeef0',
    '--muted': '#2b1217',
    '--muted-foreground': '#e0a6ad',
    '--primary': '#ef4444',
    '--primary-foreground': '#fff1f2',
    '--secondary': '#3a151b',
    '--secondary-foreground': '#ffd6db',
    '--accent': '#fb7185',
    '--accent-foreground': '#3a0d16',
    '--border': '#5f1e2a',
    '--card': '#1f0d11',
    '--card-foreground': '#ffeef0',
    '--ring': '#ef4444',
  },
  aurora: {
    '--background': '#061821',
    '--foreground': '#e9fbff',
    '--muted': '#0f2d3a',
    '--muted-foreground': '#9fc8d2',
    '--primary': '#22d3ee',
    '--primary-foreground': '#04252f',
    '--secondary': '#0f3a4b',
    '--secondary-foreground': '#d7f7ff',
    '--accent': '#34d399',
    '--accent-foreground': '#062b24',
    '--border': '#1f4f61',
    '--card': '#0a2430',
    '--card-foreground': '#e9fbff',
    '--ring': '#22d3ee',
  },
  'electric-night': {
    '--background': '#0a0a16',
    '--foreground': '#eff0ff',
    '--muted': '#16162d',
    '--muted-foreground': '#a6abd6',
    '--primary': '#4f7cff',
    '--primary-foreground': '#edf1ff',
    '--secondary': '#1a1e40',
    '--secondary-foreground': '#dfe4ff',
    '--accent': '#00d5ff',
    '--accent-foreground': '#021b2c',
    '--border': '#2a3763',
    '--card': '#10152b',
    '--card-foreground': '#eff0ff',
    '--ring': '#4f7cff',
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
