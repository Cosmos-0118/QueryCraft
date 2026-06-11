'use client';

import { useEffect } from 'react';
import { useLoadingStore } from '@/stores/loading-store';

export default function OurTeamLoading() {
  const start = useLoadingStore((state) => state.start);

  useEffect(() => {
    start('Loading team…');
  }, [start]);

  return null;
}
