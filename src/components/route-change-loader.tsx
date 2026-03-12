'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLoadingStore } from '@/stores/loading-store';

/**
 * Triggers the loading overlay on Next.js client-side route changes.
 * Mount this once inside a Suspense boundary (required for useSearchParams).
 */
export function RouteChangeLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { start, stop } = useLoadingStore();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render (initial page load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Route has finished changing — stop loading
    stop();
  }, [pathname, searchParams, stop]);

  // Intercept link clicks to start loading before navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (anchor.target === '_blank') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Only trigger if navigating to a different path
      const url = new URL(href, window.location.origin);
      if (url.pathname !== pathname) {
        start('Loading…');
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, start]);

  return null;
}
