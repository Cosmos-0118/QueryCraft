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

// Pre-built examples
const EXAMPLES = [
  {
    name: 'Student-Dept (2NF violation)',
    tableName: 'StudentDept',
    columns: ['student_id', 'course_id', 'student_name', 'dept', 'grade'],
    fds: [
      { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
      { determinant: ['student_id'], dependent: ['student_name', 'dept'] },
    ],
  },
  {
    name: 'Employee (3NF violation)',
    tableName: 'Employee',
    columns: ['emp_id', 'emp_name', 'dept_id', 'dept_name', 'manager'],
    fds: [
      { determinant: ['emp_id'], dependent: ['emp_name', 'dept_id'] },
      { determinant: ['dept_id'], dependent: ['dept_name', 'manager'] },
    ],
  },
  {
    name: 'CourseInstructor (BCNF violation)',
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
      // Clear existing FDs and add new ones
      while (store.fds.length > 0) store.removeFD(0);
      ex.fds.forEach((fd) => store.addFD(fd));
      store.setCurrentNF(null);
      store.setDecomposition(null);
    },
    [store],
  );

  const candidateKeys = store.columns.length > 0 && store.fds.length > 0
    ? findCandidateKeys(store.columns, store.fds)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Normalization Wizard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Input functional dependencies and watch your table decompose step by step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => handleLoadExample(ex)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {ex.name}
            </button>
          ))}
          <button
            onClick={store.clear}
            className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10"
          >
            Clear
          </button>
        </div>
      </div>

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

      {candidateKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm font-medium">Candidate Keys:</span>
          {candidateKeys.map((key, i) => (
            <span key={i} className="rounded bg-yellow-500/20 px-2 py-0.5 font-mono text-sm font-bold text-yellow-600">
              {'{' + key.join(', ') + '}'}
            </span>
          ))}
          {store.currentNF && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-sm font-medium">Current NF:</span>
              <NormalFormBadge nf={store.currentNF} />
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs font-medium">Target Normal Form</label>
          <select
            value={store.targetNF}
            onChange={(e) => store.setTargetNF(e.target.value as NormalForm)}
            className="mt-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="2NF">2NF</option>
            <option value="3NF">3NF</option>
            <option value="BCNF">BCNF</option>
          </select>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={store.columns.length === 0 || store.fds.length === 0}
          className="mt-5 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Analyze & Decompose
        </button>
      </div>

      {store.decomposition && (
        <>
          <DecompositionStepper
            steps={store.decomposition.steps}
            activeStep={store.activeStep}
            onStepSelect={store.setActiveStep}
          />
          {store.currentNF && store.currentNF !== 'BCNF' && store.currentNF !== '3NF' && (
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
