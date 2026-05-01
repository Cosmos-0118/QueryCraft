'use client';

import {
    Download,
    FlaskConical,
    GraduationCap,
    Landmark,
    Play,
    RotateCcw,
    School,
    Sparkles,
} from 'lucide-react';
import { useNormalizerStore } from '@/stores/normalizer-store';
import type { NormalForm } from '@/types/normalizer';

interface NormalizerToolbarProps {
    targetNF: NormalForm;
    onTargetNFChange: (normalForm: NormalForm) => void;
    onRunNormalization: () => void;
    onExport: () => void;
    isRunning: boolean;
}

const NF_OPTIONS: NormalForm[] = ['1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];

export function NormalizerToolbar({
    targetNF,
    onTargetNFChange,
    onRunNormalization,
    onExport,
    isRunning,
}: NormalizerToolbarProps) {
    const {
        inputTable,
        showSampleData,
        showFDs,
        showAnomalies,
        loadPreset,
        toggleSampleData,
        toggleFDs,
        toggleAnomalies,
        clear,
    } = useNormalizerStore();

    const presetButton =
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/60 hover:text-foreground/90';

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/75 px-3 py-2">
                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/50 p-1">
                    <button onClick={() => loadPreset('university')} className={presetButton} title="Load university preset">
                        <GraduationCap className="h-3.5 w-3.5" />
                        University
                    </button>
                    <button onClick={() => loadPreset('banking')} className={presetButton} title="Load banking preset">
                        <Landmark className="h-3.5 w-3.5" />
                        Banking
                    </button>
                    <button onClick={() => loadPreset('credentia')} className={presetButton} title="Load credentia preset">
                        <School className="h-3.5 w-3.5" />
                        Credentia
                    </button>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/45 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold">Target NF</span>
                        <select
                            value={targetNF}
                            onChange={(event) => onTargetNFChange(event.target.value as NormalForm)}
                            className="rounded bg-transparent text-xs text-foreground outline-none"
                        >
                            {NF_OPTIONS.map((option) => (
                                <option key={option} value={option} className="bg-card text-foreground">
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button
                        onClick={onRunNormalization}
                        disabled={!inputTable || isRunning}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                            boxShadow: '0 14px 34px -20px rgba(249, 115, 22, 0.8)',
                        }}
                    >
                        <Play className="h-4 w-4" />
                        {isRunning ? 'Normalizing…' : 'Run Normalization'}
                    </button>

                    <button
                        onClick={onExport}
                        disabled={!inputTable}
                        className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-muted/45 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-45"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export PNG
                    </button>

                    <button
                        onClick={clear}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/65 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85">
                    <Sparkles className="h-3.5 w-3.5" />
                    View toggles
                </span>

                <button
                    onClick={toggleSampleData}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                        borderColor: showSampleData ? 'color-mix(in oklab, var(--warning) 48%, var(--border))' : 'color-mix(in oklab, var(--border) 85%, transparent)',
                        background: showSampleData ? 'color-mix(in oklab, var(--warning) 14%, transparent)' : 'transparent',
                        color: showSampleData ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                >
                    Sample data
                </button>

                <button
                    onClick={toggleFDs}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                        borderColor: showFDs ? 'color-mix(in oklab, var(--warning) 48%, var(--border))' : 'color-mix(in oklab, var(--border) 85%, transparent)',
                        background: showFDs ? 'color-mix(in oklab, var(--warning) 14%, transparent)' : 'transparent',
                        color: showFDs ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                >
                    Functional dependencies
                </button>

                <button
                    onClick={toggleAnomalies}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                        borderColor: showAnomalies ? 'color-mix(in oklab, var(--warning) 48%, var(--border))' : 'color-mix(in oklab, var(--border) 85%, transparent)',
                        background: showAnomalies ? 'color-mix(in oklab, var(--warning) 14%, transparent)' : 'transparent',
                        color: showAnomalies ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Anomalies
                </button>
            </div>
        </div>
    );
}
