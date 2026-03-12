import Link from 'next/link';

const QUICK_ACTIONS = [
  { title: 'Continue Learning', desc: 'Resume where you left off in the lesson track.', emoji: '📚', href: '/learn' },
  { title: 'SQL Sandbox', desc: 'Write and execute SQL queries in your browser.', emoji: '💻', href: '/sandbox' },
  { title: 'Relational Algebra', desc: 'Parse and evaluate algebra expressions visually.', emoji: '🧮', href: '/algebra' },
  { title: 'ER Diagram Builder', desc: 'Design entity-relationship diagrams interactively.', emoji: '📐', href: '/er-builder' },
  { title: 'Normalization Wizard', desc: 'Decompose tables from 1NF through BCNF.', emoji: '🔄', href: '/normalizer' },
  { title: 'Practice Exercises', desc: 'Test your knowledge with auto-graded problems.', emoji: '📝', href: '/practice' },
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
            <div className="text-2xl">{card.emoji}</div>
            <h3 className="mt-3 font-semibold group-hover:text-primary">{card.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
