'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/shared/ui/loading/store';

export default function SandboxLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Initializing SQL sandbox…');
    return () => stop();
  }, [start, stop]);

  return null;
}
