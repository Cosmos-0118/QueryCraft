'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function SandboxLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Initializing SQL sandbox…');
    return () => stop();
  }, [start, stop]);

  return null;
}
