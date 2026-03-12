import { create } from 'zustand';

interface LessonStore {
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  setStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
  currentStepIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  setStep: (index) => set({ currentStepIndex: index }),
  nextStep: () => set((s) => ({ currentStepIndex: s.currentStepIndex + 1 })),
  prevStep: () => set((s) => ({ currentStepIndex: Math.max(0, s.currentStepIndex - 1) })),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),
  reset: () => set({ currentStepIndex: 0, isPlaying: false }),
}));
