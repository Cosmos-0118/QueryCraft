'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function SettingsLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading settings…');
    return () => stop();
  }, [start, stop]);

  return null;
}
