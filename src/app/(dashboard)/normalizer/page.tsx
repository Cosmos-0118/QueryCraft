'use client';

import { useCallback } from 'react';
import { useNormalizerStore } from '@/stores/normalizer-store';
import {
  detectNormalForm,
  findCandidateKeys,
  decompose,
} from '@/lib/engine/normalizer-engine';
import type { NormalForm } from '@/types/normalizer';
import { FDInput } from '@/components/normalizer/fd-input';
import { DependencyDiagram } from '@/components/normalizer/dependency-diagram';
import { NormalFormBadge } from '@/components/normalizer/normal-form-badge';
import { DecompositionStepper } from '@/components/normalizer/decomposition-stepper';
import { AnomalyDemo } from '@/components/normalizer/anomaly-demo';
import { cn } from '@/lib/utils/helpers';
import {
  Layers,
  Play,
  RotateCcw,
  KeyRound,
  GraduationCap,
  Briefcase,
  BookOpen,
} from 'lucide-react';

const EXAMPLES = [
  {
    name: 'Student-Dept',
    label: '2NF violation',
    icon: GraduationCap,
    tableName: 'StudentDept',
    columns: ['student_id', 'course_id', 'student_name', 'dept', 'grade'],
    fds: [
      { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
      { determinant: ['student_id'], dependent: ['student_name', 'dept'] },
    ],
  },
  {
    name: 'Employee',
    label: '3NF violation',
    icon: Briefcase,
    tableName: 'Employee',
    columns: ['emp_id', 'emp_name', 'dept_id', 'dept_name', 'manager'],
    fds: [
      { determinant: ['emp_id'], dependent: ['emp_name', 'dept_id'] },
      { determinant: ['dept_id'], dependent: ['dept_name', 'manager'] },
    ],
  },
  {
    name: 'CourseInstructor',
    label: 'BCNF violation',
    icon: BookOpen,
    tableName: 'CourseInstructor',
    columns: ['student', 'course', 'instructor'],
    fds: [
      { determinant: ['student', 'course'], dependent: ['instructor'] },
      { determinant: ['instructor'], dependent: ['course'] },
    ],
  },
];

export default function NormalizerPage() {
  const store = useNormalizerStore();

  const handleAnalyze = useCallback(() => {
    if (store.columns.length === 0 || store.fds.length === 0) return;
    const nf = detectNormalForm(store.columns, store.fds);
    store.setCurrentNF(nf);

    const table = {
      name: store.tableName,
      columns: store.columns,
      primaryKey: findCandidateKeys(store.columns, store.fds)[0],
      functionalDependencies: store.fds,
    };
    const result = decompose(table, store.targetNF);
    store.setDecomposition(result);
    store.setActiveStep(0);
  }, [store]);

  const handleLoadExample = useCallback(
    (ex: (typeof EXAMPLES)[number]) => {
      store.setTableName(ex.tableName);
      store.setColumns(ex.columns);
      store.setFDs(ex.fds);
      store.setCurrentNF(null);
      store.setDecomposition(null);
    },
    [store],
  );

  const candidateKeys =
    store.columns.length > 0 && store.fds.length > 0
      ? findCandidateKeys(store.columns, store.fds)
      : [];

  const fdCount = store.fds.length;
  const colCount = store.columns.length;
  const canAnalyze = colCount > 0 && fdCount > 0;

  return (
    <div className="flex flex-col gap-4 p-6 lg:p-8">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-amber-500/25"
            style={{
              background:
                'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)',
            }}
          >
            <Layers className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Normalization Wizard
            </h1>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                {colCount} attribute{colCount !== 1 ? 's' : ''}
              </span>
              <span className="text-zinc-700">&middot;</span>
              <span>{fdCount} FD{fdCount !== 1 ? 's' : ''}</span>
              {store.currentNF && (
                <>
                  <span className="text-zinc-700">&middot;</span>
                  <NormalFormBadge nf={store.currentNF} size="sm" />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Example presets */}
          <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-1 backdrop-blur-sm">
            {EXAMPLES.map((ex) => {
              const Icon = ex.icon;
              return (
                <button
                  key={ex.name}
                  onClick={() => handleLoadExample(ex)}
                  title={ex.label}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-200"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ex.name}
                </button>
              );
            })}
          </div>

          <div className="mx-0.5 h-5 w-px bg-zinc-700/50" />

          <button
            onClick={store.clear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* ── Input + Diagram side-by-side ───────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FDInput
          columns={store.columns}
          fds={store.fds}
          onAdd={store.addFD}
          onRemove={store.removeFD}
          onColumnsChange={store.setColumns}
        />
        <DependencyDiagram columns={store.columns} fds={store.fds} />
      </div>

      {/* ── Candidate Keys + Analysis bar ──────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-3">
        {candidateKeys.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Candidate Keys
            </div>
            {candidateKeys.map((key, i) => (
              <span
                key={i}
                className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-400"
              >
                {'{' + key.join(', ') + '}'}
              </span>
            ))}
            <div className="mx-1 h-4 w-px bg-zinc-700/50" />
          </>
        )}

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-zinc-400">Target</label>
          <select
            value={store.targetNF}
            onChange={(e) => store.setTargetNF(e.target.value as NormalForm)}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-xs font-medium text-zinc-300 outline-none transition-colors focus:border-amber-500/40"
          >
            <option value="2NF">2NF</option>
            <option value="3NF">3NF</option>
            <option value="BCNF">BCNF</option>
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className={cn(
            'ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold tracking-wide transition-all duration-200',
            canAnalyze
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40'
              : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed',
          )}
        >
          <Play className="h-3.5 w-3.5" />
          Analyze & Decompose
        </button>
      </div>

      {/* ── Decomposition Results ──────────────────────── */}
      {store.decomposition && (
        <>
          <DecompositionStepper
            steps={store.decomposition.steps}
            activeStep={store.activeStep}
            onStepSelect={store.setActiveStep}
          />
          {store.currentNF &&
            store.currentNF !== 'BCNF' &&
            store.currentNF !== '3NF' && (
              <AnomalyDemo
                tableName={store.tableName}
                columns={store.columns}
                primaryKey={candidateKeys[0] ?? store.columns}
              />
            )}
        </>
      )}
    </div>
  );
}
