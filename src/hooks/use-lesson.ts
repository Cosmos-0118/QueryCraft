'use client';

// Lesson playback hook — will be implemented in Phase 8
export function useLesson() {
  return {
    currentStep: null,
    stepIndex: 0,
    totalSteps: 0,
    isPlaying: false,
    next: () => {},
    prev: () => {},
    togglePlay: () => {},
    goToStep: (_index: number) => {},
  };
}
