'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircuitBoard } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { useTestAuth } from '@/features/test-module/hooks/use-test-auth';

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useHydrated();
  const { isAuthenticated, user, hydrated } = useTestAuth();

  useEffect(() => {
    if (mounted && hydrated && isAuthenticated && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [hydrated, mounted, isAuthenticated, router, user]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/60 sm:left-6 sm:top-6"
        aria-label="Back to QueryCraft home"
      >
        <div className="qc-brand-mark flex h-7 w-7 items-center justify-center rounded-md">
          <CircuitBoard size={14} suppressHydrationWarning />
        </div>
        <span className="text-sm font-bold tracking-tight text-foreground">
          Query<span className="text-primary">Craft</span>
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
