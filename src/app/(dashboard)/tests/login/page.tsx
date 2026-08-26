'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LegacyTestLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    router.replace(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login');
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8 lg:py-10">
      Redirecting to sign in...
    </div>
  );
}
