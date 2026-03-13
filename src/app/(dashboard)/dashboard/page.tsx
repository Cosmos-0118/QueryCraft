'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  FunctionSquare,
  PenTool,
  RefreshCw,
  Sigma,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { ReactNode } from 'react';

const TOOLS: {
  title: string;
  desc: string;
  icon: ReactNode;
  href: string;
  iconColor: string;
}[] = [
  {
    title: 'Commands & Syntax',
    desc: '86+ SQL commands organised by category with copyable examples.',
    icon: <BookOpen size={18} />,
    href: '/learn',
    iconColor: 'text-teal-500 bg-teal-500/10',
  },
  {
    title: 'SQL Sandbox',
    desc: 'Write and run SQL queries in-browser with autocomplete and history.',
    icon: <Terminal size={18} />,
    href: '/sandbox',
    iconColor: 'text-blue-500 bg-blue-500/10',
  },
  {
    title: 'Relational Algebra',
    desc: 'Parse and evaluate algebra expressions with a visual tree view.',
    icon: <Sigma size={18} />,
    href: '/algebra',
    iconColor: 'text-violet-500 bg-violet-500/10',
  },
  {
    title: 'Tuple Calculus',
    desc: 'Write TRC expressions and translate them directly to SQL.',
    icon: <FunctionSquare size={18} />,
    href: '/tuple-calculus',
    iconColor: 'text-sky-500 bg-sky-500/10',
  },
  {
    title: 'ER Diagram Builder',
    desc: 'Design entity-relationship diagrams on a visual canvas.',
    icon: <PenTool size={18} />,
    href: '/er-builder',
    iconColor: 'text-rose-500 bg-rose-500/10',
  },
  {
    title: 'Normalization Wizard',
    desc: 'Decompose tables step-by-step from 1NF through BCNF.',
    icon: <RefreshCw size={18} />,
    href: '/normalizer',
    iconColor: 'text-amber-500 bg-amber-500/10',
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles size={11} />
          Learning Command Center
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Good to see you. Choose a workspace.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          QueryCraft combines SQL, algebra, ER modeling, and normalization in one place.
        </p>
      </div>

      {/* Tools grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.title}
            href={tool.href}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-md"
          >
            <div className={`inline-flex w-fit rounded-lg p-2 ${tool.iconColor}`}>
              {tool.icon}
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
                {tool.title}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {tool.desc}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Open <ArrowRight size={11} />
            </div>
          </Link>
        ))}
      </div>

      {/* Stats strip */}
      <div className="mt-auto flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
        <span><span className="font-semibold text-foreground">86+</span> SQL commands</span>
        <span><span className="font-semibold text-foreground">13</span> reference categories</span>
        <span><span className="font-semibold text-foreground">7</span> interactive workspaces</span>
        <span>Live SQL feedback</span>
      </div>
    </div>
  );
}
