import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { LoadingOverlay } from '@/components/loading-overlay';
import { RouteChangeLoader } from '@/components/route-change-loader';
import { UserScopedStateSync } from '@/components/user-scoped-state-sync';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'QueryCraft — Visual DBMS Learning Platform',
  description:
    'An interactive, visual DBMS learning platform that teaches database concepts by showing — not just telling. Master SQL, relational algebra, normalization, and ER diagrams.',
  openGraph: {
    title: 'QueryCraft — Visual DBMS Learning Platform',
    description:
      'Master DBMS visually. SQL sandbox, relational algebra playground, ER diagram builder, and normalization wizard — all in one platform.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <UserScopedStateSync />
          <LoadingOverlay />
          <Suspense>
            <RouteChangeLoader />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
