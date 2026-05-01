'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import { useNormalizerStore } from '@/stores/normalizer-store';
import { AnomalyHighlight } from './anomaly-highlight';

export function NFStepDetail() {
    const { result, currentStepIndex } = useNormalizerStore();
    const [open, setOpen] = useState(true);

    const step = result?.steps[currentStepIndex] ?? null;

    const preview = useMemo(() => {
        if (!step) return null;
        return {
            before: step.inputTables.slice(0, 2),
            after: step.outputTables.slice(0, 3),
        };
    }, [step]);

    if (!step) {
        return (
            <div className="rounded-2xl border border-border bg-card/65 px-4 py-3 text-sm text-muted-foreground">
                Run normalization to inspect violations, transformations, and anomaly notes.
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border bg-card/70">
            <button
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <div>
                    <p className="text-sm font-semibold text-foreground">{step.fromNF}{' -> '}{step.toNF} details</p>
                    <p className="text-xs text-muted-foreground">{step.violationsFound.length} violation(s) reviewed</p>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            <div
                className="grid transition-all duration-200"
                style={{
                    gridTemplateRows: open ? '1fr' : '0fr',
                }}
            >
                <div className="overflow-hidden">
                    <div className="space-y-4 border-t border-border px-4 py-4">
                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">Violation Summary</p>
                            {step.violationsFound.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                    No violations were present for this transition.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {step.violationsFound.map((violation, index) => (
                                        <div key={`${violation.type}_${index}`} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                                                <TriangleAlert className="h-3.5 w-3.5" />
                                                <span className="uppercase tracking-[0.08em]">{violation.type}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-foreground/90">{violation.explanation}</p>
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                <span className="font-semibold text-foreground/90">Determinant:</span> {violation.determinant.join(', ') || '-'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                <span className="font-semibold text-foreground/90">Dependent:</span> {violation.dependent.join(', ') || '-'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">Transformation</p>
                            <p className="rounded-xl border border-border bg-muted/45 px-3 py-2 text-sm text-foreground/95">{step.explanation}</p>
                        </div>

                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">Anomaly demo</p>
                            <AnomalyHighlight anomalyDemo={step.anomalyDemo} />
                        </div>

                        {preview && (
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">Before / After</p>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                                        <p className="mb-2 text-xs font-semibold text-foreground">Before</p>
                                        <div className="space-y-2">
                                            {preview.before.map((table) => (
                                                <div key={table.id} className="rounded-lg border border-border/80 bg-card/60 px-2.5 py-2">
                                                    <p className="text-xs font-semibold text-foreground">{table.name}</p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground">{table.columns.map((column) => column.name).join(', ')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                                        <p className="mb-2 text-xs font-semibold text-foreground">After</p>
                                        <div className="space-y-2">
                                            {preview.after.map((table) => (
                                                <div key={table.id} className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2">
                                                    <p className="text-xs font-semibold text-foreground">{table.name}</p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground">{table.columns.map((column) => column.name).join(', ')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
