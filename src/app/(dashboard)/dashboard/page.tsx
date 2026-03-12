'use client';

import Link from 'next/link';
import {
  BookOpen, Terminal, Sigma, PenTool, RefreshCw,
  ArrowRight, Database, Shield, Search, Layers,
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

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome to <span className="text-primary">QueryCraft</span>
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Your all-in-one DBMS learning toolkit — explore SQL syntax, build ER diagrams,
            practice relational algebra, and master normalization.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm"
            >
              <span className="text-primary">{stat.icon}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Decorative grid */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 transition-opacity group-hover:opacity-100`} />
              <div className="relative z-10">
                <div className={`inline-flex rounded-lg border p-2 ${tool.accent}`}>
                  {tool.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold group-hover:text-primary">
                  {tool.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {tool.desc}
                </p>
              </div>
              <div className="relative z-10 mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
