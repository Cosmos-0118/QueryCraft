import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CircuitBoard, FileText, ShieldCheck } from 'lucide-react';
import type { LegalPageContent } from '@/shared/ui/legal/content';

type LegalPageProps = {
  content: LegalPageContent;
};

export function LegalPage({ content }: LegalPageProps) {
  const isPrivacy = content.title.toLowerCase().includes('privacy');
  const HeroIcon = isPrivacy ? ShieldCheck : FileText;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_34%),radial-gradient(circle_at_82%_14%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_oklab,var(--surface)_92%,transparent),var(--background)_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(color-mix(in_oklab,var(--border)_28%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--border)_24%,transparent)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/30 bg-background/72 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="qc-brand-mark flex h-7 w-7 items-center justify-center rounded-lg">
              <CircuitBoard size={13} suppressHydrationWarning />
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Query<span className="text-primary">Craft</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={content.related.href}
              className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground sm:inline-flex"
            >
              {content.related.label}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <ArrowLeft size={12} suppressHydrationWarning />
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-6 py-12 sm:py-16">
        <section className="qc-card relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <HeroIcon size={13} suppressHydrationWarning />
              {content.badge}
            </div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-foreground sm:text-5xl">
              {content.title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {content.description}
            </p>
            <p className="mt-6 text-xs font-medium text-muted-foreground">
              Last updated: <span className="text-foreground/80">{content.lastUpdated}</span>
            </p>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="space-y-5">
            {content.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 rounded-[1.5rem] border border-border/50 bg-card/80 p-6 shadow-[0_18px_48px_-38px_var(--shadow-color)] backdrop-blur-sm sm:p-7"
              >
                <h2 className="text-xl font-bold tracking-tight text-card-foreground">{section.title}</h2>
                {section.body?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-5 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-20">
            <div className="rounded-[1.5rem] border border-border/50 bg-card/75 p-5 shadow-[0_18px_48px_-40px_var(--shadow-color)] backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Quick Navigation</p>
              <nav className="mt-5 space-y-1">
                {content.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/55 hover:text-foreground"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
              <div className="mt-5 border-t border-border/40 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Related Page</p>
                <Link
                  href={content.related.href}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
                >
                  {content.related.label}
                  <ArrowUpRight size={13} suppressHydrationWarning />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
