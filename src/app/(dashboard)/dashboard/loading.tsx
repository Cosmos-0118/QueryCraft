'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function DashboardHomeLoading() {
  const { start, stop } = useLoadingStore();

  useEffect(() => {
    start('Loading dashboard…');
    return () => stop();
  }, [start, stop]);

  return null;
}
