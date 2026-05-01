'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import TileWaveCanvas from '@/components/visual/TileWaveCanvas';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore } from '@/stores/theme-store';
import { THEME_OPTIONS } from '@/lib/theme';
import {
  ArrowRight,
  BookOpen,
  Check,
  CircuitBoard,
  FunctionSquare,
  Palette,
  PenTool,
  RefreshCw,
  Sigma,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

const tools: { title: string; description: string; href: string; icon: ReactNode }[] = [
  { title: 'Guided Learn', description: 'Structured DBMS lessons with visual walkthroughs and 86+ copyable references.', href: '/learn', icon: <BookOpen size={16} suppressHydrationWarning /> },
  { title: 'SQL Sandbox', description: 'Run SQL live with autocomplete, result tables, and query history.', href: '/sandbox', icon: <Terminal size={16} suppressHydrationWarning /> },
  { title: 'Table Generator', description: 'Generate realistic datasets and SQL INSERT statements instantly.', href: '/generator', icon: <Sparkles size={16} suppressHydrationWarning /> },
  { title: 'Relational Algebra', description: 'Compose expressions, inspect evaluations, and map to SQL.', href: '/algebra', icon: <Sigma size={16} suppressHydrationWarning /> },
  { title: 'Tuple Calculus', description: 'Use TRC notation with quantifiers and convert it to SQL.', href: '/tuple-calculus', icon: <FunctionSquare size={16} suppressHydrationWarning /> },
  { title: 'ER Builder', description: 'Design models visually and convert diagrams to relational schema.', href: '/er-builder', icon: <PenTool size={16} suppressHydrationWarning /> },
  { title: 'Normalization', description: 'Walk through normal forms with decomposition visualizations.', href: '/normalizer', icon: <RefreshCw size={16} suppressHydrationWarning /> },
];

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

type ClickBurst = {
  id: number;
  x: number;
  y: number;
};

type NetworkConnection = {
  saveData?: boolean;
};

type NavigatorWithHints = Navigator & {
  connection?: NetworkConnection;
  deviceMemory?: number;
};

const shouldUseLiteMode = () => {
  if (typeof window === 'undefined') return false;

  const navigatorHints = window.navigator as NavigatorWithHints;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigatorHints.connection?.saveData ?? false;

  return prefersReducedMotion || saveData;
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const hydrated = useHydrated();
  const canUseAuthedRoutes = hydrated && isAuthenticated;
  const [clickBursts, setClickBursts] = useState<ClickBurst[]>([]);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const TRAIL_SEGMENTS = 7;
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const trailSegmentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pointerTargetRef = useRef({ x: -120, y: -120 });
  const pointerTrailRef = useRef(Array.from({ length: TRAIL_SEGMENTS }, () => ({ x: -120, y: -120 })));
  const pointerInitializedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  const liteMode = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handlePreferenceChange = () => onStoreChange();

      mediaQuery.addEventListener('change', handlePreferenceChange);
      return () => {
        mediaQuery.removeEventListener('change', handlePreferenceChange);
      };
    },
    () => shouldUseLiteMode(),
    () => false
  );

  const showMouseFx = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia('(pointer: coarse)');
      const handleModeChange = () => onStoreChange();

      mediaQuery.addEventListener('change', handleModeChange);
      return () => {
        mediaQuery.removeEventListener('change', handleModeChange);
      };
    },
    () => !liteMode && !window.matchMedia('(pointer: coarse)').matches,
    () => false
  );

  useEffect(() => {
    if (!themeMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!showMouseFx) return;

    const applyPointerPosition = (x: number, y: number) => {
      const ring = ringRef.current;
      const dot = dotRef.current;

      if (ring) {
        ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(45deg)`;
      }

      if (dot) {
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    };

    const resetTrail = (x: number, y: number) => {
      pointerTrailRef.current.forEach((point) => {
        point.x = x;
        point.y = y;
      });
    };

    const animatePointer = () => {
      const segments = trailSegmentRefs.current;
      if (segments.length === 0) {
        frameRef.current = null;
        return;
      }

      const targetX = pointerTargetRef.current.x;
      const targetY = pointerTargetRef.current.y;
      const trailPoints = pointerTrailRef.current;

      for (let index = 0; index < trailPoints.length; index += 1) {
        const previousPoint = index === 0 ? { x: targetX, y: targetY } : trailPoints[index - 1];
        const point = trailPoints[index];
        const smoothing = index === 0 ? 0.45 : Math.max(0.2, 0.42 - index * 0.035);

        point.x += (previousPoint.x - point.x) * smoothing;
        point.y += (previousPoint.y - point.y) * smoothing;

        const segment = segments[index];
        if (segment) {
          segment.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
        }
      }

      const tailEnd = trailPoints[trailPoints.length - 1];
      const trailDelta = Math.abs(targetX - tailEnd.x) + Math.abs(targetY - tailEnd.y);

      // Sleep the animation loop while idle; pointermove restarts it.
      if (trailDelta < 0.2) {
        frameRef.current = null;
        return;
      }

      frameRef.current = window.requestAnimationFrame(animatePointer);
    };

    const scheduleAnimation = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(animatePointer);
      }
    };

    const updatePointer = (event: PointerEvent) => {
      pointerTargetRef.current.x = event.clientX;
      pointerTargetRef.current.y = event.clientY;
      applyPointerPosition(event.clientX, event.clientY);

      if (!pointerInitializedRef.current) {
        pointerInitializedRef.current = true;
        resetTrail(event.clientX, event.clientY);
      }

      scheduleAnimation();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (liteMode) return;

      const burstId = event.timeStamp + Math.random();
      setClickBursts((previous) => [...previous.slice(-4), { id: burstId, x: event.clientX, y: event.clientY }]);

      window.setTimeout(() => {
        setClickBursts((previous) => previous.filter((burst) => burst.id !== burstId));
      }, 420);
    };

    const hidePointer = () => {
      pointerInitializedRef.current = false;
      pointerTargetRef.current.x = -120;
      pointerTargetRef.current.y = -120;

      applyPointerPosition(-120, -120);

      scheduleAnimation();
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerleave', hidePointer);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerleave', hidePointer);
    };
  }, [liteMode, showMouseFx]);

  return (
    <div
      className={`relative min-h-[100svh] w-full select-none overflow-x-hidden bg-background text-foreground ${liteMode ? 'qc-lite-mode' : ''}`}
      style={{ fontFamily: "'Inter', 'Geist', system-ui, sans-serif" }}
    >
      {/* Animated tile background — canvas-based for performance */}
      {!liteMode && <TileWaveCanvas theme={theme} />}

      {showMouseFx && (
        <>
          {Array.from({ length: TRAIL_SEGMENTS }, (_, index) => (
            <div
              key={`trail-${index}`}
              ref={(element) => {
                trailSegmentRefs.current[index] = element;
              }}
              aria-hidden
              className="pointer-events-none fixed left-0 top-0 z-[29] h-2 w-2 rounded-full bg-primary/70 will-change-transform"
              style={{
                opacity: Math.max(0.08, 0.32 - index * 0.035),
                scale: `${Math.max(0.45, 1 - index * 0.1)}`,
              }}
            />
          ))}

          <div
            ref={ringRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-30 h-8 w-8 border border-primary/60 will-change-transform"
          />
          <div
            ref={dotRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-30 h-1.5 w-1.5 bg-primary will-change-transform"
          />

          {clickBursts.map((burst) => (
            <motion.div
              key={burst.id}
              aria-hidden
              className="pointer-events-none fixed z-30 h-3 w-3 border border-primary"
              initial={{ x: burst.x, y: burst.y, scale: 0.2, opacity: 0.95, rotate: 20 }}
              animate={{ x: burst.x, y: burst.y, scale: 5.2, opacity: 0, rotate: 130 }}
              transition={{ duration: 0.42, ease: [0.18, 0.78, 0.2, 1] }}
              style={{ translateX: '-50%', translateY: '-50%' }}
            />
          ))}
        </>
      )}



      <div className="relative z-10">
        {/* Header */}
        <header className="relative z-10 border-b border-border/30">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <div className="qc-brand-mark flex h-6 w-6 items-center justify-center rounded-md">
                <CircuitBoard size={12} suppressHydrationWarning />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">
                Query<span className="text-primary">Craft</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme switcher */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Switch theme"
                >
                  <Palette size={16} suppressHydrationWarning />
                </button>

                {themeMenuOpen && (
                  <div className="qc-popover absolute right-0 top-full z-[500] mt-2 w-[340px] overflow-hidden rounded-2xl">
                    <div className="p-3">
                      <div className="mb-3 flex items-center justify-between px-0.5">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Appearance</p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                          {theme.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {THEME_OPTIONS.map((option) => {
                          const isActive = theme === option.value;
                          return (
                            <button
                              key={option.value}
                              onClick={() => { setTheme(option.value); setThemeMenuOpen(false); }}
                              className={`group relative flex flex-col items-start gap-2 rounded-xl p-2.5 text-left transition-all duration-150 ${
                                isActive
                                  ? 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                                  : 'hover:bg-muted/70 hover:ring-1 hover:ring-inset hover:ring-border/60'
                              }`}
                            >
                              <span
                                className="qc-theme-swatch h-10 w-full rounded-lg"
                                data-theme={option.value}
                              />
                              <span className={`block truncate text-[11px] font-semibold leading-tight ${isActive ? 'text-primary' : 'text-foreground/80'}`}>
                                {option.label}
                              </span>
                              {isActive && (
                                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                                  <Check size={9} className="text-primary-foreground" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={canUseAuthedRoutes ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                Launch App <ArrowRight size={11} suppressHydrationWarning />
              </Link>
            </div>
          </div>
        </header>

        <main className="relative flex flex-col">
          {/* Hero */}
          <section className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[1400px] items-center px-6 py-16 lg:px-10 lg:py-20">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative"
            >
              {/* Soft glass backdrop behind text for readability */}
              <div
                className="pointer-events-none absolute -inset-x-8 -inset-y-6 -z-10 rounded-3xl"
                style={{
                  background: 'radial-gradient(ellipse 120% 100% at 0% 50%, color-mix(in oklab, var(--background) 60%, transparent) 0%, color-mix(in oklab, var(--background) 25%, transparent) 60%, transparent 100%)',
                }}
              />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Database Learning Studio</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
                Master SQL.<br />
                <span className="text-muted-foreground">Understand the theory.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                One workspace for SQL, relational algebra, ER diagrams, and normalization — so every concept reinforces the next.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={canUseAuthedRoutes ? "/dashboard" : "/login"}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 hover:shadow-primary/30"
                >
                  Get Started <ArrowRight size={13} suppressHydrationWarning />
                </Link>
                <Link
                  href={canUseAuthedRoutes ? "/learn" : "/login?next=%2Flearn"}
                  className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-6 py-2.5 text-sm font-medium text-foreground/70 backdrop-blur-sm transition hover:border-border/70 hover:bg-muted/40 hover:text-foreground"
                >
                  Browse SQL Reference
                </Link>
              </div>
            </motion.div>
          </section>

          {/* Divider */}
          <div className="mx-auto w-full max-w-[1400px] border-t border-border/30 px-6 lg:px-10" />

          {/* Tools */}
          <section className="mx-auto w-full max-w-[1400px] px-6 py-20 lg:px-10">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <p className="mb-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">7 Workspaces</p>
              <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((tool, i) => (
                  <motion.div
                    key={tool.title}
                    className="h-full"
                    initial={{ opacity: 0 }}
                    whileHover={{ y: -2 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <Link
                      href={canUseAuthedRoutes ? tool.href : `/login?next=${encodeURIComponent(tool.href)}`}
                      className="group relative flex h-full min-h-[220px] flex-col rounded-2xl border border-border/50 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition duration-200 hover:border-primary/35 hover:shadow-[0_18px_45px_-28px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
                    >
                      <div className="absolute left-5 right-5 top-0 h-px bg-foreground/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-foreground/70 transition-colors group-hover:border-primary/40 group-hover:text-primary">
                          {tool.icon}
                        </div>
                        <ArrowRight size={13} className="mt-1 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" suppressHydrationWarning />
                      </div>
                      <div className="mt-4 flex-1">
                        <h3 className="text-base font-semibold text-card-foreground group-hover:text-foreground">{tool.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
                      </div>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">Open Workspace</p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Simple CTA */}
          <section className="mx-auto w-full max-w-[1400px] border-t border-border/30 px-6 py-16 text-center lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-lg font-bold text-foreground">Ready to build real database intuition?</p>
              <p className="mt-1 text-sm text-muted-foreground">Free to use. No credit card required.</p>
              <Link
                href={canUseAuthedRoutes ? "/dashboard" : "/login"}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                Start Learning <ArrowRight size={13} suppressHydrationWarning />
              </Link>
            </motion.div>
          </section>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border/20 px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between lg:px-4">
            <span className="text-xs font-bold text-muted-foreground/60">Query<span className="text-primary">Craft</span></span>
            <p className="text-xs text-muted-foreground/60">© 2026 QueryCraft</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
