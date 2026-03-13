'use client';

import Link from 'next/link';
import {
  BookOpen, Terminal, Sigma, PenTool, RefreshCw, FunctionSquare,
  ArrowRight, Database, Shield, Search, Layers, Sparkles, Orbit,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* ── Tool Cards ── */
const TOOLS: {
  title: string;
  desc: string;
  icon: ReactNode;
  href: string;
  color: string;
  accent: string;
}[] = [
  {
    title: 'Commands & Syntax',
    desc: '13 categories · 86+ commands with copyable examples across DDL, DML, Joins, PL/SQL and more.',
    icon: <BookOpen size={20} />,
    href: '/learn',
    color: 'from-emerald-500/15 to-emerald-500/5',
    accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'SQL Sandbox',
    desc: 'Write and run SQL queries in-browser with autocomplete, multiple datasets, and rich query history.',
    icon: <Terminal size={20} />,
    href: '/sandbox',
    color: 'from-blue-500/15 to-blue-500/5',
    accent: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    title: 'Relational Algebra',
    desc: 'Parse, evaluate, and convert algebra expressions with an interactive expression tree visualizer.',
    icon: <Sigma size={20} />,
    href: '/algebra',
    color: 'from-violet-500/15 to-violet-500/5',
    accent: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    title: 'Tuple Relational Calculus',
    desc: 'Write TRC expressions, translate to SQL, and run them directly against live datasets.',
    icon: <FunctionSquare size={20} />,
    href: '/tuple-calculus',
    color: 'from-cyan-500/15 to-cyan-500/5',
    accent: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    title: 'ER Diagram Builder',
    desc: 'Design entity-relationship diagrams with entities, attributes, and relationships on a visual canvas.',
    icon: <PenTool size={20} />,
    href: '/er-builder',
    color: 'from-amber-500/15 to-amber-500/5',
    accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    title: 'Normalization Wizard',
    desc: 'Analyze functional dependencies and decompose tables step-by-step from 1NF through BCNF.',
    icon: <RefreshCw size={20} />,
    href: '/normalizer',
    color: 'from-rose-500/15 to-rose-500/5',
    accent: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
];

/* ── Quick Stats ── */
const STATS: { label: string; value: string; icon: ReactNode }[] = [
  { label: 'SQL Commands', value: '86+', icon: <Database size={16} /> },
  { label: 'Categories', value: '13', icon: <Layers size={16} /> },
  { label: 'Constraints', value: '7', icon: <Shield size={16} /> },
  { label: 'Join Types', value: '7', icon: <Search size={16} /> },
];

const HIGHLIGHTS: { title: string; detail: string; icon: ReactNode }[] = [
  {
    title: 'Visual First Learning',
    detail: 'Watch results update step-by-step instead of memorizing syntax in isolation.',
    icon: <Sparkles size={16} />,
  },
  {
    title: 'From Theory to Practice',
    detail: 'Move across SQL, algebra, ER modeling, and normalization with one shared mental model.',
    icon: <Orbit size={16} />,
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(to_left,rgba(255,255,255,0.06),transparent)]" />

        <div className="relative z-10 grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles size={14} className="text-primary" />
              DBMS Learning Studio
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Build strong database intuition with
              <span className="block text-primary">interactive, visual workflows</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              QueryCraft combines SQL practice, relational algebra, normalization, and data modeling in one place so
              each concept reinforces the next.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur-sm"
                >
                  <div className="mb-2 inline-flex rounded-lg bg-primary/10 p-1.5 text-primary">
                    {stat.icon}
                  </div>
                  <p className="text-xl font-semibold leading-none">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 self-end">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur"
              >
                <div className="mb-2 inline-flex rounded-md bg-primary/10 p-1.5 text-primary">{item.icon}</div>
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspaces</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Pick where you want to train next</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group relative flex min-h-52 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

              <div className="relative z-10">
                <div className={`inline-flex rounded-xl border p-2.5 ${tool.accent}`}>
                  {tool.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight group-hover:text-primary">
                  {tool.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {tool.desc}
                </p>
              </div>

              <div className="relative z-10 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary opacity-60 transition-opacity group-hover:opacity-100">
                Open Workspace <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
