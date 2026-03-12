'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function LearnLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading lessons…');
    return () => stop();
  }, [start, stop]);

  return null;
}
