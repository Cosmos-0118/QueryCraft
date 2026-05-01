'use client';

import type { AnomalyDemo } from '@/types/normalizer';

interface AnomalyHighlightProps {
    anomalyDemo?: AnomalyDemo;
}

export function AnomalyHighlight({ anomalyDemo }: AnomalyHighlightProps) {
    if (!anomalyDemo) return null;

    const entries = [
        { key: 'insert', label: 'Insert anomaly', value: anomalyDemo.insertAnomaly, tone: 'amber' },
        { key: 'update', label: 'Update anomaly', value: anomalyDemo.updateAnomaly, tone: 'orange' },
        { key: 'delete', label: 'Delete anomaly', value: anomalyDemo.deleteAnomaly, tone: 'rose' },
    ].filter((entry) => typeof entry.value === 'string' && entry.value.length > 0);

    if (entries.length === 0) return null;

    return (
        <div className="grid gap-2 md:grid-cols-3">
            {entries.map((entry) => (
                <div
                    key={entry.key}
                    className="rounded-xl border px-3 py-2"
                    style={{
                        borderColor: `color-mix(in oklab, var(--${entry.tone === 'rose' ? 'danger' : 'warning'}) 40%, var(--border))`,
                        background: `color-mix(in oklab, var(--${entry.tone === 'rose' ? 'danger' : 'warning'}) 12%, transparent)`,
                    }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">{entry.label}</p>
                    <p className="mt-1 text-xs text-foreground/90">{entry.value}</p>
                </div>
            ))}
        </div>
    );
}
