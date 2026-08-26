'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
      Registration now starts from universal login. Redirecting...
    </div>
  );
}
