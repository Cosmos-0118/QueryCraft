import { create } from 'zustand';

interface LoadingStore {
  isLoading: boolean;
  message: string;
  progress: number | null; // null = indeterminate, 0-100 = determinate
  start: (message?: string) => void;
  setProgress: (progress: number) => void;
  setMessage: (message: string) => void;
  stop: () => void;
}

export const useLoadingStore = create<LoadingStore>()((set) => ({
  isLoading: false,
  message: '',
  progress: null,
  start: (message = '') => set({ isLoading: true, message, progress: null }),
  setProgress: (progress) => set({ progress: Math.min(100, Math.max(0, progress)) }),
  setMessage: (message) => set({ message }),
  stop: () => set({ isLoading: false, message: '', progress: null }),
}));
