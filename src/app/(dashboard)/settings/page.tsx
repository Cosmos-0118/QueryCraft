'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile');
  }, [router]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8 lg:py-10">
      Redirecting to profile...
    </div>
  );
}
