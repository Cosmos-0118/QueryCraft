'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function NormalizerLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading normalization wizard…');
    return () => stop();
  }, [start, stop]);

  return null;
}
