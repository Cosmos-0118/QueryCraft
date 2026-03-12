'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore, type AppearanceMode, type ColorTheme } from '@/stores/theme-store';
import {
  LayoutDashboard, BookOpen, Terminal, Sigma, PenTool, RefreshCw,
  Settings, Sun, Moon, Monitor, Palette, Sparkles,
} from 'lucide-react';

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const NAV_ITEMS: { label: string; href: string; icon: ReactNode }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Learn', href: '/learn', icon: <BookOpen size={18} /> },
  { label: 'SQL Sandbox', href: '/sandbox', icon: <Terminal size={18} /> },
  { label: 'Table Generator', href: '/generator', icon: <Sparkles size={18} /> },
  { label: 'Algebra', href: '/algebra', icon: <Sigma size={18} /> },
  { label: 'ER Builder', href: '/er-builder', icon: <PenTool size={18} /> },
  { label: 'Normalizer', href: '/normalizer', icon: <RefreshCw size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
];

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
];

const COLOR_THEME_OPTIONS: { value: ColorTheme; label: string; swatch: string }[] = [
  { value: 'purple', label: 'Purple', swatch: '#6d28d9' },
  { value: 'ocean', label: 'Ocean', swatch: '#0369a1' },
  { value: 'emerald', label: 'Emerald', swatch: '#059669' },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          <span className={i === segments.length - 1 ? 'font-medium text-foreground' : ''}>
            {seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useHydrated();
  const { user, isAuthenticated, logout } = useAuth();
  const { appearance, colorTheme, setAppearance, setColorTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (mounted && !isAuthenticated && !redirected.current) {
      redirected.current = true;
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            <span className="text-primary">Query</span>Craft
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.displayName || 'Guest'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-6">
              <span className="text-lg font-bold">
                <span className="text-primary">Query</span>Craft
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
              </svg>
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2">
            {/* Theme selector */}
            <div className="relative">
              <button
                onClick={() => { setThemeMenuOpen(!themeMenuOpen); setUserMenuOpen(false); }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Theme settings"
              >
                <Palette size={18} />
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Appearance
                  </p>
                  <div className="flex gap-1">
                    {APPEARANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearance(opt.value)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors flex items-center justify-center gap-1 ${
                          appearance === opt.value
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Color Theme
                  </p>
                  <div className="space-y-1">
                    {COLOR_THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setColorTheme(opt.value)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          colorTheme === opt.value
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-border"
                          style={{ backgroundColor: opt.swatch }}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setThemeMenuOpen(false); }}
                className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-border bg-card py-1 shadow-lg">
                  <div className="border-b border-border px-4 py-2">
                    <p className="truncate text-sm font-medium">{user?.displayName || 'Guest'}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-muted"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
