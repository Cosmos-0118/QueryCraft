'use client';

// Session persistence hook — will be implemented in Phase 10
export function useSessionPersistence() {
  return {
    save: async () => {},
    restore: async () => {},
    isLoading: false,
  };
}
