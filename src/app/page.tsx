'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Database,
  FunctionSquare,
  PenTool,
  RefreshCw,
  Sparkles,
  Sigma,
  Terminal,
} from 'lucide-react';
import type { ReactNode } from 'react';

const tools: { title: string; description: string; href: string; icon: ReactNode; tone: string }[] = [
  {
    title: 'Guided Learn',
    description: 'Structured DBMS lessons with visual walkthroughs and practice-ready explanations.',
    href: '/learn',
    icon: <BookOpen size={18} />,
    tone: 'from-sky-500/20 to-indigo-500/10',
  },
  {
    title: 'SQL Sandbox',
    description: 'Run SQL live with visual result feedback, history, and schema-aware workflows.',
    href: '/sandbox',
    icon: <Terminal size={18} />,
    tone: 'from-emerald-500/20 to-cyan-500/10',
  },
  {
    title: 'Table Generator',
    description: 'Generate realistic datasets and SQL inserts instantly for multi-table practice.',
    href: '/generator',
    icon: <Sparkles size={18} />,
    tone: 'from-fuchsia-500/20 to-violet-500/10',
  },
  {
    title: 'Relational Algebra',
    description: 'Compose expressions, inspect step-by-step evaluation, and map directly to SQL.',
    href: '/algebra',
    icon: <Sigma size={18} />,
    tone: 'from-violet-500/20 to-fuchsia-500/10',
  },
  {
    title: 'Tuple Calculus',
    description: 'Use textbook TRC notation with quantifiers and convert it to executable SQL.',
    href: '/tuple-calculus',
    icon: <FunctionSquare size={18} />,
    tone: 'from-cyan-500/20 to-blue-500/10',
  },
  {
    title: 'ER Builder',
    description: 'Design models visually and turn diagrams into relational schema in one click.',
    href: '/er-builder',
    icon: <PenTool size={18} />,
    tone: 'from-amber-500/20 to-orange-500/10',
  },
  {
    title: 'Normalization',
    description: 'Walk through normal forms with decomposition and anomaly demonstrations.',
    href: '/normalizer',
    icon: <RefreshCw size={18} />,
    tone: 'from-rose-500/20 to-pink-500/10',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070f] text-zinc-100">
      <AnimatedBackground />

      <header className="relative z-20 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          <span className="text-lg font-semibold tracking-wide text-zinc-100">
            Query<span className="text-cyan-300">Craft</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/20 hover:text-cyan-100"
            >
              Launch App
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto w-full max-w-7xl px-6 pb-16 pt-20 lg:px-8 lg:pb-24 lg:pt-28">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-zinc-300"
          >
            <Database size={13} className="text-cyan-300" />
            Visual DBMS Lab
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.08, duration: 0.65, ease: 'easeOut' }}
            className="mt-6 max-w-4xl text-5xl font-black leading-[1.03] tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl"
          >
            Master Databases
            <span className="block bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400 bg-clip-text text-transparent">
              by Seeing Every Step
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.16, duration: 0.6, ease: 'easeOut' }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg"
          >
            QueryCraft turns SQL, Algebra, Tuple Calculus, ER modeling, and normalization into an interactive
            learning experience with live execution, visual transitions, and clear concept mapping.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.24, duration: 0.55, ease: 'easeOut' }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_10px_40px_rgba(34,211,238,0.25)] transition hover:translate-y-[-1px]"
            >
              Get Started
              <ArrowRight size={15} />
            </Link>
          </motion.div>
        </section>

        <section id="tools" className="mx-auto w-full max-w-7xl px-6 pb-20 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.08 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {tools.map((tool) => (
              <motion.div
                key={tool.title}
                variants={fadeUp}
                whileHover={{ y: -5, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/65 p-5 backdrop-blur-sm"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tool.tone} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                <motion.div
                  className="pointer-events-none absolute -left-24 top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  initial={{ x: -120 }}
                  whileHover={{ x: 520 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
                <div className="relative z-10">
                  <div className="inline-flex rounded-lg border border-white/15 bg-white/5 p-2 text-cyan-200">
                    {tool.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-100">{tool.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{tool.description}</p>
                  <Link
                    href={`/login?next=${encodeURIComponent(tool.href)}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition group-hover:text-cyan-200"
                  >
                    Open
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}

function AnimatedBackground() {
  const particles = Array.from({ length: 14 }, (_, idx) => idx);

  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute left-[-8%] top-[-12%] h-[42rem] w-[42rem] rounded-full bg-cyan-500/20 blur-3xl"
        animate={{ x: [0, 30, -12, 0], y: [0, -18, 10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[-10%] top-[18%] h-[36rem] w-[36rem] rounded-full bg-blue-500/20 blur-3xl"
        animate={{ x: [0, -26, 14, 0], y: [0, 22, -8, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-18%] left-[30%] h-[34rem] w-[34rem] rounded-full bg-violet-500/15 blur-3xl"
        animate={{ x: [0, 22, -18, 0], y: [0, -14, 12, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)',
          backgroundSize: '30px 30px',
        }}
        animate={{ backgroundPosition: ['0px 0px', '30px 30px', '0px 0px'] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />

      {particles.map((idx) => {
        const size = 2 + (idx % 3);
        const left = 4 + ((idx * 7) % 92);
        const duration = 10 + (idx % 6) * 2;
        const delay = (idx % 5) * 0.6;
        return (
          <motion.span
            key={idx}
            className="absolute rounded-full bg-cyan-100/35"
            style={{ width: size, height: size, left: `${left}%`, top: `${80 + (idx % 8)}%` }}
            animate={{ y: [0, -220 - idx * 8], opacity: [0, 0.7, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
          />
        );
      })}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),rgba(5,7,15,0.8)_45%,rgba(5,7,15,1)_70%)]" />
    </div>
  );
}
