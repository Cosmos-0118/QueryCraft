'use client';

import { useEffect } from 'react';
import { useThemeStore, type ColorTheme } from '@/stores/theme-store';

const COLOR_THEMES: Record<ColorTheme, { light: Record<string, string>; dark: Record<string, string> }> = {
  purple: {
    light: {
      '--background': '#ffffff',
      '--foreground': '#0a0a0a',
      '--muted': '#f5f5f5',
      '--muted-foreground': '#737373',
      '--primary': '#6d28d9',
      '--primary-foreground': '#ffffff',
      '--secondary': '#f3f4f6',
      '--secondary-foreground': '#1f2937',
      '--accent': '#8b5cf6',
      '--accent-foreground': '#ffffff',
      '--border': '#e5e7eb',
      '--card': '#ffffff',
      '--card-foreground': '#0a0a0a',
      '--ring': '#6d28d9',
    },
    dark: {
      '--background': '#09090b',
      '--foreground': '#fafafa',
      '--muted': '#27272a',
      '--muted-foreground': '#a1a1aa',
      '--primary': '#7c3aed',
      '--primary-foreground': '#ffffff',
      '--secondary': '#1e1e22',
      '--secondary-foreground': '#fafafa',
      '--accent': '#a78bfa',
      '--accent-foreground': '#09090b',
      '--border': '#27272a',
      '--card': '#111113',
      '--card-foreground': '#fafafa',
      '--ring': '#7c3aed',
    },
  },
  ocean: {
    light: {
      '--background': '#fafcff',
      '--foreground': '#0c1525',
      '--muted': '#eef3fa',
      '--muted-foreground': '#5b7091',
      '--primary': '#0369a1',
      '--primary-foreground': '#ffffff',
      '--secondary': '#e0f2fe',
      '--secondary-foreground': '#0c4a6e',
      '--accent': '#0ea5e9',
      '--accent-foreground': '#ffffff',
      '--border': '#cbd5e1',
      '--card': '#ffffff',
      '--card-foreground': '#0c1525',
      '--ring': '#0369a1',
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
  },
  emerald: {
    light: {
      '--background': '#fafdfb',
      '--foreground': '#0a1a0f',
      '--muted': '#ecfdf5',
      '--muted-foreground': '#4b7c5c',
      '--primary': '#059669',
      '--primary-foreground': '#ffffff',
      '--secondary': '#d1fae5',
      '--secondary-foreground': '#064e3b',
      '--accent': '#10b981',
      '--accent-foreground': '#ffffff',
      '--border': '#c6ddd0',
      '--card': '#ffffff',
      '--card-foreground': '#0a1a0f',
      '--ring': '#059669',
    },
    dark: {
      '--background': '#080f0b',
      '--foreground': '#ecfdf5',
      '--muted': '#1a2e23',
      '--muted-foreground': '#86efac',
      '--primary': '#34d399',
      '--primary-foreground': '#052e1c',
      '--secondary': '#1a2e23',
      '--secondary-foreground': '#ecfdf5',
      '--accent': '#10b981',
      '--accent-foreground': '#080f0b',
      '--border': '#2d4a3a',
      '--card': '#0d1a12',
      '--card-foreground': '#ecfdf5',
      '--ring': '#34d399',
    },
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { appearance, colorTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Determine if dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark =
      appearance === 'dark' || (appearance === 'system' && prefersDark.matches);

    // Apply color theme variables
    const vars = COLOR_THEMES[colorTheme][isDark ? 'dark' : 'light'];
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    // Toggle dark class for potential utility usage
    root.classList.toggle('dark', isDark);

    // Listen for system preference changes
    const handler = (e: MediaQueryListEvent) => {
      if (appearance === 'system') {
        const newVars = COLOR_THEMES[colorTheme][e.matches ? 'dark' : 'light'];
        for (const [key, value] of Object.entries(newVars)) {
          root.style.setProperty(key, value);
        }
        root.classList.toggle('dark', e.matches);
      }
    };

    prefersDark.addEventListener('change', handler);
    return () => prefersDark.removeEventListener('change', handler);
  }, [appearance, colorTheme]);

  return <>{children}</>;
}
