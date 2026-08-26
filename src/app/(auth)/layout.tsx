'use client';

import { useRouter } from 'next/navigation';
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
