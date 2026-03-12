'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function AlgebraLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading algebra playground…');
    return () => stop();
  }, [start, stop]);

  return null;
}
