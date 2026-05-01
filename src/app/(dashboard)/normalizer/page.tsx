'use client';

import { Layers, Wrench, ArrowRight } from 'lucide-react';

const PLANNED_FEATURES = [
  'Free-form canvas with draggable table nodes (like ER Builder)',
  'Step-by-step transformation from UNF through 5NF',
  'Standalone normalization engine handling any table shape',
  'Live functional dependency inference & editing',
  'Visual anomaly demonstrations at each normal form',
  'Preset seed datasets for quick experimentation',
];

export default function NormalizerPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-6 lg:p-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur-sm sm:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-amber-500/25">
              <Layers className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Normalizer Studio
              </h1>
              <p className="text-xs text-muted-foreground/80">
                Rebuilding from scratch
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <Wrench className="h-4 w-4" />
              Under Construction
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              The normalizer is being completely rebuilt with a new canvas-based
              UI and a dedicated normalization engine. Check{' '}
              <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs font-mono text-foreground/80">
                ROADMAP.md
              </code>{' '}
              for the implementation plan.
            </p>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Planned Features
            </p>
            <ul className="space-y-2">
              {PLANNED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
