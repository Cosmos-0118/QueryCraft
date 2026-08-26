'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTestAuth } from '@/features/test-module/hooks/use-test-auth';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useTestAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [hydrated, isAuthenticated, router, user]);

  return null;
}
