'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import { useLoadingStore } from '@/stores/loading-store';
import { THEME_OPTIONS } from '@/lib/theme';
import {
  LayoutDashboard, BookOpen, Terminal, Sigma, PenTool, RefreshCw,
  Settings, Moon, Sun, Palette, Sparkles, FunctionSquare,
  CircuitBoard, LogOut, ChevronRight,
} from 'lucide-react';

const emptySubscribe = () => () => { };
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const NAV_ITEMS: { label: string; href: string; icon: ReactNode; group?: string }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} />, group: 'Main' },
  { label: 'Learn', href: '/learn', icon: <BookOpen size={16} />, group: 'Main' },
  { label: 'SQL Sandbox', href: '/sandbox', icon: <Terminal size={16} />, group: 'Labs' },
  { label: 'Table Generator', href: '/generator', icon: <Sparkles size={16} />, group: 'Labs' },
  { label: 'Test Module', href: '/tests', icon: <BookOpen size={16} />, group: 'Labs' },
  { label: 'Algebra', href: '/algebra', icon: <Sigma size={16} />, group: 'Theory' },
  { label: 'Tuple Calculus', href: '/tuple-calculus', icon: <FunctionSquare size={16} />, group: 'Theory' },
  { label: 'ER Builder', href: '/er-builder', icon: <PenTool size={16} />, group: 'Theory' },
  { label: 'Normalizer', href: '/normalizer', icon: <RefreshCw size={16} />, group: 'Theory' },
  { label: 'Settings', href: '/settings', icon: <Settings size={16} />, group: 'Account' },
];

const NAV_GROUPS = ['Main', 'Labs', 'Theory', 'Account'];

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
  light: <Sun size={14} />,
  dark: <Moon size={14} />,
  signature: <Palette size={14} />,
  crimson: <Palette size={14} />,
  aurora: <Palette size={14} />,
  'electric-night': <Palette size={14} />,
};

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="opacity-40" />}
          <span className={i === segments.length - 1 ? 'font-semibold text-foreground' : ''}>
            {seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  );
}

function SidebarLogo() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-4">
      <div className="qc-brand-mark flex h-7 w-7 items-center justify-center rounded-lg">
        <CircuitBoard size={14} />
      </div>
      <Link href="/dashboard" className="text-[15px] font-black tracking-tight text-foreground">
        Query<span className="text-primary">Craft</span>
      </Link>
    </div>
  );
}

function SidebarNav({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group);
        return (
          <div key={group} className="mb-3">
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{group}</p>
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive
                      ? 'qc-nav-active'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <span className={`transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && <span className="ml-auto"><ChevronRight size={12} className="opacity-30" /></span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useHydrated();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const redirected = useRef(false);
  const { start: startLoading, stop: stopLoading } = useLoadingStore();

  useEffect(() => {
    if (mounted && !isAuthenticated && !redirected.current) {
      redirected.current = true;
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) {
      startLoading('Authenticating…');
    } else {
      stopLoading();
    }
  }, [mounted, isAuthenticated, startLoading, stopLoading]);

  if (!mounted || !isAuthenticated) {
    return null;
  }

  const initials = user?.displayName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="qc-app-shell flex min-h-[100svh] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="qc-sidebar hidden w-56 shrink-0 flex-col overflow-hidden border-r border-border/60 lg:flex">
        <SidebarLogo />
        <SidebarNav pathname={pathname} />
        {/* User footer */}
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="qc-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground/80">{user?.displayName || 'Guest'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="qc-sidebar absolute left-0 top-0 flex h-full w-56 flex-col shadow-2xl">
            <SidebarLogo />
            <SidebarNav pathname={pathname} onClose={() => setMobileOpen(false)} />
            <div className="border-t border-border/60 p-3">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <div className="qc-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
                  {initials}
                </div>
                <p className="truncate text-xs font-semibold text-foreground/80">{user?.displayName || 'Guest'}</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="qc-topbar relative z-50 flex h-14 shrink-0 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
              </svg>
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2">
            {/* Theme button */}
            <div className="relative">
              <button
                onClick={() => { setThemeMenuOpen(!themeMenuOpen); setUserMenuOpen(false); }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Palette size={16} />
              </button>
              {themeMenuOpen && (
                <div className="qc-popover absolute right-0 top-full z-[500] mt-2 w-64 overflow-hidden rounded-xl">
                  <div className="p-2">
                    <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Theme</p>
                    <div className="space-y-1">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${theme === option.value
                              ? 'bg-primary/12 font-semibold text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            }`}
                        >
                          <span className="qc-theme-swatch h-5 w-5 shrink-0 rounded-full" data-theme={option.value} />
                          <span className={theme === option.value ? 'text-primary' : ''}>{THEME_ICONS[option.value]}</span>
                          <span className="min-w-0">
                            <span className="block leading-tight">{option.label}</span>
                            <span className="block truncate text-[10px] font-normal text-muted-foreground">{option.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setThemeMenuOpen(false); }}
                className="qc-avatar flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-105"
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div className="qc-popover absolute right-0 top-full z-[500] mt-2 w-44 overflow-hidden rounded-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold">{user?.displayName || 'Guest'}</p>

                  </div>
                  <div className="p-1">
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Settings size={14} /> Settings
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut size={14} /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
