'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function GeneratorLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading data generator…');
    return () => stop();
  }, [start, stop]);

  return null;
}
