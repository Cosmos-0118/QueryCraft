'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/shared/ui/loading/store';

export default function LearnLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading lessons…');
    return () => stop();
  }, [start, stop]);

  return null;
}
