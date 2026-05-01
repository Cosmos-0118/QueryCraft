'use client';

import { Check, Circle } from 'lucide-react';
import { detectNormalForm } from '@/lib/engine/normalizer-engine';
import { useNormalizerStore } from '@/stores/normalizer-store';
import type { NormalForm } from '@/types/normalizer';

const ORDER: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];

interface NFStepperProps {
    targetNF: NormalForm;
}

export function NFStepper({ targetNF }: NFStepperProps) {
    const { inputTable, result, currentStepIndex, setStep } = useNormalizerStore();

    const detected = result?.detectedNF ?? (inputTable ? detectNormalForm(inputTable) : 'UNF');
    const detectedIndex = ORDER.indexOf(detected);
    const targetIndex = ORDER.indexOf(targetNF);

    const activeIndex = result && result.steps.length > 0
        ? Math.min(detectedIndex + currentStepIndex + 1, ORDER.length - 1)
        : detectedIndex;

    const visibleMaxIndex = Math.max(targetIndex, detectedIndex);

    const countByForm = new Map<NormalForm, number>();
    countByForm.set(detected, inputTable ? 1 : 0);
    if (result) {
        for (const step of result.steps) {
            countByForm.set(step.toNF, step.outputTables.length);
        }
    }

    return (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/70 px-3 py-3">
            <div className="flex min-w-max items-center gap-2">
                {ORDER.filter((_, index) => index <= visibleMaxIndex).map((normalForm, index) => {
                    const isCompleted = index < activeIndex;
                    const isActive = index === activeIndex;
                    const isFuture = index > activeIndex;
                    const tableCount = countByForm.get(normalForm);

                    return (
                        <button
                            key={normalForm}
                            onClick={() => {
                                if (!result || result.steps.length === 0) return;
                                const targetStepIndex = Math.max(0, index - detectedIndex - 1);
                                setStep(targetStepIndex);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
                            style={{
                                borderColor: isActive
                                    ? 'color-mix(in oklab, var(--warning) 55%, var(--border))'
                                    : 'color-mix(in oklab, var(--border) 85%, transparent)',
                                background: isActive
                                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.14) 100%)'
                                    : isCompleted
                                        ? 'color-mix(in oklab, var(--warning) 14%, transparent)'
                                        : 'color-mix(in oklab, var(--surface-soft) 72%, transparent)',
                                color: isFuture ? 'var(--muted-foreground)' : 'var(--foreground)',
                                opacity: isFuture ? 0.75 : 1,
                            }}
                        >
                            <span className="inline-flex h-4 w-4 items-center justify-center">
                                {isCompleted ? <Check className="h-3.5 w-3.5 text-amber-300" /> : <Circle className="h-3.5 w-3.5" />}
                            </span>
                            <span>{normalForm}</span>
                            {typeof tableCount === 'number' && tableCount > 0 && (
                                <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px]">
                                    {tableCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
