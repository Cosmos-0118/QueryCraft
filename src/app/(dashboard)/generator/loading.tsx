'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/shared/ui/loading/store';

export default function GeneratorLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading data generator…');
    return () => stop();
  }, [start, stop]);

  return null;
}
