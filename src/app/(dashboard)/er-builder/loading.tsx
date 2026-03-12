'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function ERBuilderLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading ER diagram builder…');
    return () => stop();
  }, [start, stop]);

  return null;
}
