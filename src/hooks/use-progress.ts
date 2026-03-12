'use client';

// Progress tracking hook — will be implemented in Phase 10
export function useProgress() {
  return {
    progress: [],
    isLoading: false,
    updateProgress: async () => {},
  };
}
