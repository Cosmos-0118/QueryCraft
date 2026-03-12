'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function DashboardLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Preparing dashboard…');
    return () => stop();
  }, [start, stop]);

  // Render nothing — the overlay handles the UI
  return null;
}
