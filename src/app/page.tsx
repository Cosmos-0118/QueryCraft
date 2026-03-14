'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CircuitBoard,
  FunctionSquare,
  PenTool,
  RefreshCw,
  Sigma,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

const tools: { title: string; description: string; href: string; icon: ReactNode }[] = [
  { title: 'Guided Learn', description: 'Structured DBMS lessons with visual walkthroughs and 86+ copyable references.', href: '/learn', icon: <BookOpen size={16} /> },
  { title: 'SQL Sandbox', description: 'Run SQL live with autocomplete, result tables, and query history.', href: '/sandbox', icon: <Terminal size={16} /> },
  { title: 'Table Generator', description: 'Generate realistic datasets and SQL INSERT statements instantly.', href: '/generator', icon: <Sparkles size={16} /> },
  { title: 'Relational Algebra', description: 'Compose expressions, inspect evaluations, and map to SQL.', href: '/algebra', icon: <Sigma size={16} /> },
  { title: 'Tuple Calculus', description: 'Use TRC notation with quantifiers and convert it to SQL.', href: '/tuple-calculus', icon: <FunctionSquare size={16} /> },
  { title: 'ER Builder', description: 'Design models visually and convert diagrams to relational schema.', href: '/er-builder', icon: <PenTool size={16} /> },
  { title: 'Normalization', description: 'Walk through normal forms with decomposition visualizations.', href: '/normalizer', icon: <RefreshCw size={16} /> },
];

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

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
  const lowCoreCount = (navigatorHints.hardwareConcurrency ?? 8) <= 4;
  const lowMemory = typeof navigatorHints.deviceMemory === 'number' && navigatorHints.deviceMemory <= 4;

  return prefersReducedMotion || saveData || lowCoreCount || lowMemory;
};

export default function Home() {
  const [clickBursts, setClickBursts] = useState<ClickBurst[]>([]);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const pointerTargetRef = useRef({ x: -120, y: -120 });
  const pointerRingRef = useRef({ x: -120, y: -120 });
  const pointerDotRef = useRef({ x: -120, y: -120 });
  const pointerInitializedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

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

  const backgroundTiles = useMemo(() => {
    const tileCount = liteMode ? 160 : 720;
    const maxDurationSteps = liteMode ? 4 : 8;

    return Array.from({ length: tileCount }, (_, i) => ({
      id: i,
      delay: ((i * 37) % 100) / 18,
      duration: 4.8 + (i % maxDurationSteps) * 0.45,
    }));
  }, [liteMode]);

  useEffect(() => {
    if (!showMouseFx) return;

    const animatePointer = () => {
      const ring = ringRef.current;
      const dot = dotRef.current;
      if (!ring || !dot) {
        frameRef.current = null;
        return;
      }

      const targetX = pointerTargetRef.current.x;
      const targetY = pointerTargetRef.current.y;

      const ringDistance = Math.abs(targetX - pointerRingRef.current.x) + Math.abs(targetY - pointerRingRef.current.y);

      const ringLerp = ringDistance > 70 ? 0.5 : 0.3;

      pointerRingRef.current.x += (targetX - pointerRingRef.current.x) * ringLerp;
      pointerRingRef.current.y += (targetY - pointerRingRef.current.y) * ringLerp;

      pointerDotRef.current.x = targetX;
      pointerDotRef.current.y = targetY;

      ring.style.transform = `translate3d(${pointerRingRef.current.x}px, ${pointerRingRef.current.y}px, 0) translate(-50%, -50%) rotate(45deg)`;
      dot.style.transform = `translate3d(${pointerDotRef.current.x}px, ${pointerDotRef.current.y}px, 0) translate(-50%, -50%)`;

      const ringDelta = Math.abs(targetX - pointerRingRef.current.x) + Math.abs(targetY - pointerRingRef.current.y);
      const dotDelta = Math.abs(targetX - pointerDotRef.current.x) + Math.abs(targetY - pointerDotRef.current.y);

      if (ringDelta < 0.15 && dotDelta < 0.15) {
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

      if (!pointerInitializedRef.current) {
        pointerInitializedRef.current = true;
        pointerRingRef.current.x = event.clientX;
        pointerRingRef.current.y = event.clientY;
        pointerDotRef.current.x = event.clientX;
        pointerDotRef.current.y = event.clientY;

        const ring = ringRef.current;
        const dot = dotRef.current;
        if (ring && dot) {
          ring.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%) rotate(45deg)`;
          dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
        }
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
      className={`relative min-h-[100svh] w-full overflow-x-hidden bg-[#050810] text-slate-100 ${liteMode ? 'qc-lite-mode' : ''}`}
      style={{ fontFamily: "'Inter', 'Geist', system-ui, sans-serif" }}
    >
      {/* Animated tile background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#050810]" />
        <div className="qc-tile-grid absolute inset-0 opacity-70">
          {backgroundTiles.map((tile) => (
            <span
              key={tile.id}
              className="qc-bg-tile"
              style={{ animationDelay: `${tile.delay}s`, animationDuration: `${tile.duration}s` }}
            />
          ))}
        </div>
      </div>

      {showMouseFx && (
        <>
          <div
            ref={ringRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-30 h-8 w-8 border border-teal-300/70 will-change-transform"
          />
          <div
            ref={dotRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-30 h-1.5 w-1.5 bg-teal-200 will-change-transform"
          />

          {clickBursts.map((burst) => (
            <motion.div
              key={burst.id}
              aria-hidden
              className="pointer-events-none fixed z-30 h-3 w-3 border border-teal-200"
              initial={{ x: burst.x, y: burst.y, scale: 0.2, opacity: 0.95, rotate: 20 }}
              animate={{ x: burst.x, y: burst.y, scale: 5.2, opacity: 0, rotate: 130 }}
              transition={{ duration: 0.42, ease: [0.18, 0.78, 0.2, 1] }}
              style={{ translateX: '-50%', translateY: '-50%' }}
            />
          ))}
        </>
      )}

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[rgba(0,0,0,0.15)]" />

      <div className="relative z-10">
        {/* Header */}
        <header className="relative z-10 border-b border-white/[0.06]">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-400">
                <CircuitBoard size={12} className="text-black" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                Query<span className="text-teal-400">Craft</span>
              </span>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.13]"
            >
              Launch App <ArrowRight size={11} />
            </Link>
          </div>
        </header>

        <main className="relative z-10 flex flex-col">
          {/* Hero */}
          <section className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[1400px] items-center px-6 py-16 lg:px-10 lg:py-20">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">Database Learning Studio</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
                Master SQL.<br />
                <span className="text-zinc-400">Understand the theory.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
                One workspace for SQL, relational algebra, ER diagrams, and normalization — so every concept reinforces the next.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-teal-300"
                >
                  Get Started <ArrowRight size={13} />
                </Link>
                <Link
                  href="/login?next=%2Flearn"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  Browse SQL Reference
                </Link>
              </div>
            </motion.div>
          </section>

          {/* Divider */}
          <div className="mx-auto w-full max-w-[1400px] border-t border-white/[0.06] px-6 lg:px-10" />

          {/* Tools */}
          <section className="mx-auto w-full max-w-[1400px] px-6 py-20 lg:px-10">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <p className="mb-8 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">7 Workspaces</p>
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
                      href={`/login?next=${encodeURIComponent(tool.href)}`}
                      className="group relative flex h-full min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#0b1222] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition duration-200 hover:border-teal-400/35 hover:shadow-[0_18px_45px_-28px_rgba(45,212,191,0.5)]"
                    >
                      <div className="absolute left-5 right-5 top-0 h-px bg-white/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-2.5 text-zinc-300 transition-colors group-hover:border-teal-300/40 group-hover:text-teal-300">
                          {tool.icon}
                        </div>
                        <ArrowRight size={13} className="mt-1 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-teal-300" />
                      </div>
                      <div className="mt-4 flex-1">
                        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white">{tool.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{tool.description}</p>
                      </div>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition-colors group-hover:text-zinc-300">Open Workspace</p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Simple CTA */}
          <section className="mx-auto w-full max-w-[1400px] border-t border-white/[0.06] px-6 py-16 text-center lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-lg font-bold text-white">Ready to build real database intuition?</p>
              <p className="mt-1 text-sm text-zinc-400">Free to use. No credit card required.</p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-400 px-7 py-2.5 text-sm font-bold text-black transition hover:bg-teal-300"
              >
                Start Learning <ArrowRight size={13} />
              </Link>
            </motion.div>
          </section>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/[0.05] px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between lg:px-4">
            <span className="text-xs font-bold text-zinc-600">Query<span className="text-teal-500">Craft</span></span>
            <p className="text-xs text-zinc-600">© 2025 QueryCraft</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
