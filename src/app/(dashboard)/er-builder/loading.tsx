'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/shared/ui/loading/store';

export default function ERBuilderLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading ER diagram builder…');
    return () => stop();
  }, [start, stop]);

  return null;
}
