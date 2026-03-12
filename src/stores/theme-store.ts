import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'purple' | 'ocean' | 'emerald';
export type AppearanceMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  appearance: AppearanceMode;
  colorTheme: ColorTheme;
  setAppearance: (mode: AppearanceMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      appearance: 'system',
      colorTheme: 'purple',
      setAppearance: (appearance) => set({ appearance }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
    }),
    { name: 'querycraft-theme' },
  ),
);
