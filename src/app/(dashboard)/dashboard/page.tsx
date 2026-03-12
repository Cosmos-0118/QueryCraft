import Link from 'next/link';
import {
  BookOpen, Terminal, Sigma, PenTool, RefreshCw, ClipboardList,
} from 'lucide-react';
import type { ReactNode } from 'react';

const QUICK_ACTIONS: { title: string; desc: string; icon: ReactNode; href: string }[] = [
  { title: 'Continue Learning', desc: 'Resume where you left off in the lesson track.', icon: <BookOpen size={24} />, href: '/learn' },
  { title: 'SQL Sandbox', desc: 'Write and execute SQL queries in your browser.', icon: <Terminal size={24} />, href: '/sandbox' },
  { title: 'Relational Algebra', desc: 'Parse and evaluate algebra expressions visually.', icon: <Sigma size={24} />, href: '/algebra' },
  { title: 'ER Diagram Builder', desc: 'Design entity-relationship diagrams interactively.', icon: <PenTool size={24} />, href: '/er-builder' },
  { title: 'Normalization Wizard', desc: 'Decompose tables from 1NF through BCNF.', icon: <RefreshCw size={24} />, href: '/normalizer' },
  { title: 'Practice Exercises', desc: 'Test your knowledge with auto-graded problems.', icon: <ClipboardList size={24} />, href: '/practice' },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to QueryCraft. Your learning progress and quick actions appear here.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
          >
            <div className="text-2xl text-primary">{card.icon}</div>
            <h3 className="mt-3 font-semibold group-hover:text-primary">{card.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
