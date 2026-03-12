'use client';

// sql.js engine hook — will be implemented in Phase 4
export function useSqlEngine() {
  return {
    isReady: false,
    execute: async (_query: string) => {
      throw new Error('Not implemented — Phase 4');
    },
    getTables: () => [],
    reset: () => {},
  };
}
