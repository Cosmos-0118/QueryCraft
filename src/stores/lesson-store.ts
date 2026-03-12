import { create } from 'zustand';
import type { Lesson } from '@/types/lesson';

interface LessonStore {
  lesson: Lesson | null;
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  completedSteps: Set<number>;
  setLesson: (lesson: Lesson) => void;
  setStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  markStepComplete: (index: number) => void;
  reset: () => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
  lesson: null,
  currentStepIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  completedSteps: new Set<number>(),
  setLesson: (lesson) =>
    set({ lesson, currentStepIndex: 0, isPlaying: false, completedSteps: new Set<number>() }),
  setStep: (index) => set({ currentStepIndex: index }),
  nextStep: () =>
    set((s) => {
      const max = s.lesson ? s.lesson.steps.length - 1 : 0;
      const next = Math.min(s.currentStepIndex + 1, max);
      const completed = new Set(s.completedSteps);
      completed.add(s.currentStepIndex);
      return { currentStepIndex: next, completedSteps: completed };
    }),
  prevStep: () => set((s) => ({ currentStepIndex: Math.max(0, s.currentStepIndex - 1) })),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),
  markStepComplete: (index) =>
    set((s) => {
      const completed = new Set(s.completedSteps);
      completed.add(index);
      return { completedSteps: completed };
    }),
  reset: () =>
    set({ lesson: null, currentStepIndex: 0, isPlaying: false, completedSteps: new Set<number>() }),
}));
