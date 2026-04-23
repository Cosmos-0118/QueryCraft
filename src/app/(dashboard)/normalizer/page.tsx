'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSeedDatasets, type SeedDataset } from '@/lib/seed-datasets';
import { useNormalizerStore } from '@/stores/normalizer-store';
import {
  detectNormalForm,
  findCandidateKeys,
  decompose,
  inferPrimaryKey,
  inferFunctionalDependencies,
  normalizeToFirstNormalFormRows,
} from '@/lib/engine/normalizer-engine';
import type { FunctionalDependency, NormalForm } from '@/types/normalizer';
import { UNFTableEditor } from '@/components/normalizer/unf-table-editor';
import { FDInput } from '@/components/normalizer/fd-input';
import { DependencyDiagram } from '@/components/normalizer/dependency-diagram';
import { NormalFormBadge } from '@/components/normalizer/normal-form-badge';
import { DecompositionStepper } from '@/components/normalizer/decomposition-stepper';
import { AnomalyDemo } from '@/components/normalizer/anomaly-demo';
import { cn } from '@/lib/utils/helpers';
import {
  Database,
  KeyRound,
  Layers,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';

const FORM_TABS: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];
const FEATURED_DATASETS = ['university', 'banking', 'credentia'] as const;

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))
  );
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function alignRowsToColumns(columns: string[], rows: string[][]): string[][] {
  if (columns.length === 0) return [];
  return rows.map((row) => {
    if (row.length === columns.length) return row;
    if (row.length > columns.length) return row.slice(0, columns.length);
    return [...row, ...Array.from({ length: columns.length - row.length }, () => '')];
  });
}

function getDatasetTableNames(dataset?: SeedDataset): string[] {
  if (!dataset) return [];

  return Object.entries(dataset.data)
    .filter(([, value]) => isRecordArray(value))
    .map(([tableName]) => tableName)
    .sort((a, b) => a.localeCompare(b));
}

function loadDatasetTable(dataset: SeedDataset, tableName: string): {
  tableName: string;
  columns: string[];
  rows: string[][];
} | null {
  const tableValue = dataset.data[tableName];
  if (!isRecordArray(tableValue) || tableValue.length === 0) return null;

  const columns = Array.from(
    new Set(
      tableValue.flatMap((row) => Object.keys(row)),
    ),
  );

  const rows = tableValue.slice(0, 15).map((row) => columns.map((column) => stringifyCell(row[column])));

  return {
    tableName,
    columns,
    rows,
  };
}

function toTitle(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeFDList(fds: FunctionalDependency[]): string[] {
  return fds
    .map((fd) => {
      const determinant = [...new Set(fd.determinant)].sort().join(',');
      const dependent = [...new Set(fd.dependent)].sort().join(',');
      return `${determinant}->${dependent}`;
    })
    .sort((a, b) => a.localeCompare(b));
}

function areFDListsEqual(a: FunctionalDependency[], b: FunctionalDependency[]): boolean {
  if (a.length !== b.length) return false;

  const left = normalizeFDList(a);
  const right = normalizeFDList(b);
  return left.every((entry, index) => entry === right[index]);
}

export default function NormalizerPage() {
  const store = useNormalizerStore();

  const [seedDatasets, setSeedDatasets] = useState<SeedDataset[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string>(FEATURED_DATASETS[0]);
  const [selectedTable, setSelectedTable] = useState<string>('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadSeeds() {
      setIsSeedLoading(true);
      setSeedError(null);

      try {
        const datasets = await fetchSeedDatasets(controller.signal);
        if (!active) return;

        const filtered = datasets.filter((dataset) =>
          FEATURED_DATASETS.includes(dataset.name as (typeof FEATURED_DATASETS)[number]),
        );

        setSeedDatasets(filtered);
      } catch {
        if (!active) return;
        setSeedError('Unable to load dataset presets right now.');
      } finally {
        if (active) setIsSeedLoading(false);
      }
    }

    void loadSeeds();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const activeDataset = useMemo(
    () => seedDatasets.find((dataset) => dataset.name === selectedDataset),
    [seedDatasets, selectedDataset],
  );

  const availableTables = useMemo(
    () => getDatasetTableNames(activeDataset),
    [activeDataset],
  );

  useEffect(() => {
    if (availableTables.length === 0) {
      setSelectedTable('');
      return;
    }

    if (!availableTables.includes(selectedTable)) {
      setSelectedTable(availableTables[0]);
    }
  }, [availableTables, selectedTable]);

  const normalizedRows = useMemo(
    () => alignRowsToColumns(store.columns, store.rows),
    [store.columns, store.rows],
  );

  const atomicRows = useMemo(
    () => normalizeToFirstNormalFormRows(normalizedRows),
    [normalizedRows],
  );

  const autoInferredFDs = useMemo(
    () => inferFunctionalDependencies(store.columns, atomicRows),
    [store.columns, atomicRows],
  );

  useEffect(() => {
    if (areFDListsEqual(store.fds, autoInferredFDs)) return;
    store.setFDs(autoInferredFDs);
  }, [autoInferredFDs, store]);

  const effectiveFDs = autoInferredFDs;

  const inferredPrimaryKey = useMemo(
    () => inferPrimaryKey(store.columns, normalizedRows, effectiveFDs),
    [store.columns, normalizedRows, effectiveFDs],
  );

  const candidateKeys = useMemo(() => {
    if (store.columns.length === 0) return [];

    const keysFromFD = findCandidateKeys(store.columns, effectiveFDs);
    const primaryKeySignature = inferredPrimaryKey.join('|');
    const hasPrimaryAlready = keysFromFD.some((key) => key.join('|') === primaryKeySignature);

    if (!hasPrimaryAlready && inferredPrimaryKey.length > 0) {
      return [inferredPrimaryKey, ...keysFromFD];
    }

    return keysFromFD;
  }, [store.columns, effectiveFDs, inferredPrimaryKey]);

  const canNormalize = store.columns.length > 0;

  const runNormalization = useCallback(
    (targetForm: NormalForm) => {
      if (store.columns.length === 0) return;

      const nextRows = alignRowsToColumns(store.columns, store.rows);
      const sourceFDs = inferFunctionalDependencies(
        store.columns,
        normalizeToFirstNormalFormRows(nextRows),
      );
      const primaryKey = inferPrimaryKey(store.columns, nextRows, sourceFDs);
      const keysFromFD = findCandidateKeys(store.columns, sourceFDs);
      const keys = keysFromFD.some((key) => key.join('|') === primaryKey.join('|'))
        ? keysFromFD
        : [primaryKey, ...keysFromFD];
      const currentNF = detectNormalForm(store.columns, sourceFDs, keys, nextRows);

      store.setRows(nextRows);
      store.setFDs(sourceFDs);
      store.setCurrentNF(currentNF);
      store.setTargetNF(targetForm);
      store.setSelectedForm(targetForm);

      const table = {
        name: store.tableName || 'R',
        columns: store.columns,
        primaryKey: primaryKey.length > 0 ? primaryKey : (keys[0] ?? store.columns),
        functionalDependencies: sourceFDs,
        sampleData: nextRows,
      };

      const result = decompose(table, targetForm);
      store.setDecomposition(result);

      let stepIndex = result.steps.length - 1;
      for (let i = result.steps.length - 1; i >= 0; i--) {
        if (result.steps[i].normalForm === targetForm) {
          stepIndex = i;
          break;
        }
      }
      store.setActiveStep(stepIndex);
    },
    [store],
  );

  const handleLoadDatasetTable = useCallback(() => {
    if (!activeDataset || !selectedTable) return;

    const loaded = loadDatasetTable(activeDataset, selectedTable);
    if (!loaded) {
      setSeedError('Selected dataset table is empty or unsupported.');
      return;
    }

    const nextRows = alignRowsToColumns(loaded.columns, loaded.rows);

    store.setTableName(`${toTitle(activeDataset.name)}_${loaded.tableName}`);
    store.setColumns(loaded.columns);
    store.setRows(nextRows);
    store.setFDs([]);
    store.setCurrentNF(null);
    store.setDecomposition(null);
    store.setActiveStep(0);
    store.setTargetNF('UNF');
    store.setSelectedForm('UNF');
    setSeedError(null);
  }, [activeDataset, selectedTable, store]);

  const handleColumnsChange = useCallback(
    (columns: string[]) => {
      const nextRows = alignRowsToColumns(columns, store.rows);

      store.setColumns(columns);
      store.setRows(nextRows);
      store.setFDs([]);
      store.setCurrentNF(null);
      store.setDecomposition(null);
    },
    [store],
  );

  const handleRowsChange = useCallback(
    (rows: string[][]) => {
      const nextRows = alignRowsToColumns(store.columns, rows);

      store.setRows(nextRows);
      store.setFDs([]);
      store.setCurrentNF(null);
      store.setDecomposition(null);
    },
    [store],
  );

  const handleStepSelect = useCallback(
    (step: number) => {
      store.setActiveStep(step);
      const stepForm = store.decomposition?.steps[step]?.normalForm;
      if (stepForm) {
        store.setSelectedForm(stepForm);
      }
    },
    [store],
  );

  const handleClear = useCallback(() => {
    store.clear();
    store.setTargetNF('UNF');
  }, [store]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/25">
            <Layers className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Normalizer Studio</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Build a custom UNF relation, load seeded datasets, and switch between normalization forms instantly.
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span>{store.columns.length} attributes</span>
              <span className="text-zinc-700">·</span>
              <span>{store.rows.length} rows</span>
              <span className="text-zinc-700">·</span>
              <span>{effectiveFDs.length} FD{effectiveFDs.length !== 1 ? 's' : ''}</span>
              {store.currentNF && (
                <>
                  <span className="text-zinc-700">·</span>
                  <NormalFormBadge nf={store.currentNF} size="sm" />
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear Workspace
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Database className="h-3.5 w-3.5 text-cyan-300" />
              Seed Databases
            </div>
            {FEATURED_DATASETS.map((datasetName) => (
              <button
                key={datasetName}
                onClick={() => setSelectedDataset(datasetName)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all',
                  selectedDataset === datasetName
                    ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-200'
                    : 'border-zinc-700/50 bg-zinc-800/35 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
                )}
              >
                {toTitle(datasetName)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTable}
              onChange={(event) => setSelectedTable(event.target.value)}
              disabled={availableTables.length === 0}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 outline-none transition-colors focus:border-cyan-500/40"
            >
              {availableTables.length === 0 ? (
                <option value="">No tables found</option>
              ) : (
                availableTables.map((tableName) => (
                  <option key={tableName} value={tableName}>
                    {tableName}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={handleLoadDatasetTable}
              disabled={isSeedLoading || !activeDataset || !selectedTable}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/12 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-all hover:border-cyan-500/45 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700/50 disabled:bg-zinc-800/30 disabled:text-zinc-600"
            >
              <Upload className="h-3.5 w-3.5" />
              Load Table
            </button>
          </div>
        </div>

        {(seedError || isSeedLoading) && (
          <p className="mt-2.5 text-xs text-zinc-500">
            {isSeedLoading ? 'Loading seed datasets...' : seedError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <UNFTableEditor
          tableName={store.tableName}
          columns={store.columns}
          rows={store.rows}
          onTableNameChange={store.setTableName}
          onColumnsChange={handleColumnsChange}
          onRowsChange={handleRowsChange}
        />

        <FDInput
          columns={store.columns}
          fds={effectiveFDs}
          onColumnsChange={handleColumnsChange}
          hideAttributesInput
          readOnly
          readOnlyHint="Functional dependencies are inferred automatically from your current table rows."
        />
      </div>

      <DependencyDiagram columns={store.columns} fds={effectiveFDs} />

      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <KeyRound className="h-3.5 w-3.5 text-cyan-300" />
              Candidate Keys
            </div>
            {candidateKeys.length > 0 ? (
              candidateKeys.map((key, index) => (
                <span
                  key={index}
                  className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300"
                >
                  {'{' + key.join(', ') + '}'}
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-500">Add attributes to compute keys.</span>
            )}
          </div>

          <button
            onClick={() => runNormalization(store.selectedForm)}
            disabled={!canNormalize}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
              canNormalize
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40'
                : 'cursor-not-allowed bg-zinc-800/50 text-zinc-600',
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Selected Form
          </button>
        </div>

        <div className="mt-4 border-t border-zinc-800/70 pt-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Normal Form Navigator
          </div>
          <div className="flex flex-wrap gap-2">
            {FORM_TABS.map((form) => (
              <button
                key={form}
                onClick={() => runNormalization(form)}
                disabled={!canNormalize}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all',
                  store.selectedForm === form
                    ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-200'
                    : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
                  !canNormalize && 'cursor-not-allowed border-zinc-800/60 text-zinc-600 hover:text-zinc-600',
                )}
              >
                {form}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Click any form to generate and jump to that normalized view.
          </p>
        </div>
      </div>

      {store.decomposition && (
        <>
          <DecompositionStepper
            steps={store.decomposition.steps}
            activeStep={store.activeStep}
            onStepSelect={handleStepSelect}
          />

          {(store.selectedForm === 'UNF' ||
            store.selectedForm === '1NF' ||
            store.selectedForm === '2NF') && (
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
