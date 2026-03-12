import Link from 'next/link';

const features = [
  {
    icon: '🎯',
    title: 'Guided Lessons',
    description:
      'Step-by-step visual tutorials covering all 5 DBMS units. Watch tables form, queries execute, and schemas transform in real time.',
  },
  {
    icon: '💻',
    title: 'SQL Sandbox',
    description:
      'Write and execute SQL in your browser — no server needed. Auto-generate data, see instant visual results with highlighted changes.',
  },
  {
    icon: '🧮',
    title: 'Relational Algebra',
    description:
      'Type algebra expressions (σ, π, ⋈, ∪, −, ×, ρ), see them parsed into trees, and watch step-by-step evaluation with intermediate results.',
  },
  {
    icon: '📐',
    title: 'ER Diagram Builder',
    description:
      'Drag-and-drop entities, relationships, and attributes. Auto-convert your ER diagram to relational tables with one click.',
  },
  {
    icon: '🔄',
    title: 'Normalization Wizard',
    description:
      'Input a table with functional dependencies. Watch it decompose 1NF → 2NF → 3NF → BCNF with anomaly demonstrations at each step.',
  },
  {
    icon: '📝',
    title: 'Practice Exercises',
    description:
      'Auto-graded problems across all topics. Get instant feedback, progressive hints, and track your mastery over time.',
  },
];

const units = [
  { num: 1, title: 'Introduction to DBMS', topics: 'File systems, terminologies, architecture, data models, ER diagrams' },
  { num: 2, title: 'Relational DBMS', topics: 'ER-to-relational mapping, relational algebra, relational calculus' },
  { num: 3, title: 'SQL', topics: 'DDL, DML, constraints, joins, set operations, subqueries, PL/SQL, triggers' },
  { num: 4, title: 'Normalization', topics: 'Anomalies, 1NF, 2NF, 3NF, BCNF, 4NF, 5NF' },
  { num: 5, title: 'Concurrency & Advanced', topics: 'ACID, transactions, concurrency control, recovery, NoSQL' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-primary">Query</span>Craft
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Learn DBMS by{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Seeing It Happen
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Stop memorizing SQL syntax from textbooks. Watch tables form, queries execute, rows
            highlight, and schemas transform — all in real time. The visual DBMS learning platform
            built for students.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start Learning Free
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-border px-8 py-3 text-base font-semibold transition-colors hover:bg-muted"
            >
              See Features
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything You Need to Master DBMS
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Six powerful tools that turn abstract database theory into interactive, visual experiences.
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Syllabus Coverage */}
      <section className="border-t border-border bg-muted/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Full Syllabus Coverage
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Aligned with 21CSC205P — covering all 5 units with interactive lessons, exercises, and
            visual demos.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <div
                key={unit.num}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {unit.num}
                  </span>
                  <h3 className="font-semibold">{unit.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{unit.topics}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to See Databases Come Alive?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Create your free account and start learning DBMS the visual way. No credit card required.
        </p>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Get Started Now
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">QueryCraft</span> — Built for students,
            by students.
          </p>
        </div>
      </footer>
    </div>
  );
}
