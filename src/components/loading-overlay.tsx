'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useLoadingStore } from '@/stores/loading-store';

// ── Animated brand mark: "Q" drawn with SVG path animation ─
function BrandMark() {
  const draw: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: (i: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: { delay: i * 0.2, duration: 0.8, ease: 'easeInOut' as const },
    }),
  };

  return (
    <motion.svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className="drop-shadow-[0_0_20px_rgba(124,58,237,0.35)]"
    >
      {/* Q body */}
      <motion.path
        d="M24 8C15.2 8 8 15.2 8 24C8 32.8 15.2 40 24 40C28.4 40 32.4 38.2 35.2 35.2"
        stroke="url(#qc-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        variants={draw}
        custom={0}
        initial="hidden"
        animate="visible"
      />
      {/* Q tail */}
      <motion.path
        d="M30 30L40 40"
        stroke="url(#qc-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        variants={draw}
        custom={1}
        initial="hidden"
        animate="visible"
      />
      <defs>
        <linearGradient id="qc-grad" x1="8" y1="8" x2="40" y2="40">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

// ── Spinner ring around the brand mark ─────────────────────
function SpinnerRing() {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <svg className="h-full w-full" viewBox="0 0 80 80" fill="none">
        <circle
          cx="40"
          cy="40"
          r="36"
          stroke="var(--primary)"
          strokeOpacity="0.08"
          strokeWidth="2"
        />
        <path
          d="M40 4C20.1 4 4 20.1 4 40"
          stroke="url(#spin-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="spin-grad" x1="40" y1="4" x2="4" y2="40">
            <stop stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

// ── Progress bar ───────────────────────────────────────────
function ProgressBar({ progress }: { progress: number | null }) {
  return (
    <div className="h-[3px] w-40 overflow-hidden rounded-full bg-primary/10">
      {progress !== null ? (
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      ) : (
        <motion.div
          className="h-full w-2/5 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0"
          animate={{ left: ['-40%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'relative' }}
        />
      )}
    </div>
  );
}

// ── Main overlay ───────────────────────────────────────────
export function LoadingOverlay() {
  const { isLoading, message, progress } = useLoadingStore();

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loading-overlay"
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />

          {/* Subtle glow */}
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-5"
            initial={{ scale: 0.92, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: -6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Brand mark with spinner ring */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <SpinnerRing />
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BrandMark />
              </motion.div>
            </div>

            {/* Progress */}
            <ProgressBar progress={progress} />

            {/* Message */}
            <AnimatePresence mode="wait">
              {message && (
                <motion.p
                  key={message}
                  className="text-sm font-medium text-muted-foreground"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
