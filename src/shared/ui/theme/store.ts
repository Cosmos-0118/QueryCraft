import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@/shared/ui/theme/theme';

export type { ThemeMode } from '@/shared/ui/theme/theme';

interface ThemeStore {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'querycraft-theme' },
  ),
);
