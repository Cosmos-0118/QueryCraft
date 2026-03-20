'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useERStore } from '@/stores/er-store';
import { ERCanvas } from '@/components/er-diagram/er-canvas';
import { ERToolbar } from '@/components/er-diagram/er-toolbar';
import { PropertiesPanel } from '@/components/er-diagram/properties-panel';
import { erToRelational, schemasToSQL } from '@/lib/engine/er-to-relational';
import type { ERDiagram } from '@/types/er-diagram';
import {
  GraduationCap,
  Landmark,
  School,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PanelRightOpen,
  PanelRightClose,
  Copy,
  Check,
  Database,
} from 'lucide-react';

/* ── Preset Diagrams ──────────────────────────────────────── */

const UNIVERSITY_DIAGRAM: ERDiagram = {
  entities: [
    { id: 'e1', name: 'Student', isWeak: false, position: { x: 80, y: 140 } },
    { id: 'e2', name: 'Department', isWeak: false, position: { x: 780, y: 140 } },
    { id: 'e3', name: 'Course', isWeak: false, position: { x: 400, y: 480 } },
  ],
  attributes: [
    /* Student attrs — fanned upper-left (away from diagram center) */
    { id: 'a1', name: 'student_id', kind: 'key', entityId: 'e1', position: { x: -70, y: 50 } },
    { id: 'a2', name: 'name', kind: 'regular', entityId: 'e1', position: { x: -100, y: 150 } },
    { id: 'a3', name: 'gpa', kind: 'regular', entityId: 'e1', position: { x: -70, y: 250 } },
    /* Department attrs — fanned upper-right */
    { id: 'a4', name: 'dept_id', kind: 'key', entityId: 'e2', position: { x: 980, y: 70 } },
    { id: 'a5', name: 'dept_name', kind: 'regular', entityId: 'e2', position: { x: 990, y: 180 } },
    /* Course attrs — fanned downward */
    { id: 'a6', name: 'course_id', kind: 'key', entityId: 'e3', position: { x: 260, y: 560 } },
    { id: 'a7', name: 'title', kind: 'regular', entityId: 'e3', position: { x: 420, y: 620 } },
    { id: 'a8', name: 'credits', kind: 'regular', entityId: 'e3', position: { x: 580, y: 560 } },
  ],
  relationships: [
    { id: 'r1', name: 'belongs_to', cardinality: '1:N', entities: ['e2', 'e1'], position: { x: 430, y: 110 } },
    { id: 'r2', name: 'enrolls', cardinality: 'M:N', entities: ['e1', 'e3'], position: { x: 190, y: 330 } },
    { id: 'r3', name: 'offers', cardinality: '1:N', entities: ['e2', 'e3'], position: { x: 640, y: 330 } },
  ],
};

const BANKING_DIAGRAM: ERDiagram = {
  entities: [
    { id: 'e1', name: 'Customer', isWeak: false, position: { x: 80, y: 140 } },
    { id: 'e2', name: 'Account', isWeak: false, position: { x: 780, y: 140 } },
    { id: 'e3', name: 'Branch', isWeak: false, position: { x: 400, y: 480 } },
  ],
  attributes: [
    /* Customer: outward angle ≈ upper-left */
    { id: 'a1', name: 'cust_id', kind: 'key', entityId: 'e1', position: { x: -60, y: 103 } },
    { id: 'a2', name: 'name', kind: 'regular', entityId: 'e1', position: { x: -58, y: 230 } },
    { id: 'a3', name: 'phone', kind: 'multivalued', entityId: 'e1', position: { x: 21, y: 0 } },
    /* Account: outward angle ≈ upper-right */
    { id: 'a4', name: 'acct_no', kind: 'key', entityId: 'e2', position: { x: 1000, y: 105 } },
    { id: 'a5', name: 'balance', kind: 'regular', entityId: 'e2', position: { x: 922, y: 2 } },
    /* Branch: outward angle ≈ straight down */
    { id: 'a6', name: 'branch_id', kind: 'key', entityId: 'e3', position: { x: 423, y: 690 } },
    { id: 'a7', name: 'branch_name', kind: 'regular', entityId: 'e3', position: { x: 549, y: 658 } },
    { id: 'a8', name: 'city', kind: 'regular', entityId: 'e3', position: { x: 305, y: 636 } },
  ],
  relationships: [
    { id: 'r1', name: 'has', cardinality: '1:N', entities: ['e1', 'e2'], position: { x: 430, y: 110 } },
    { id: 'r2', name: 'maintained_at', cardinality: '1:N', entities: ['e3', 'e2'], position: { x: 620, y: 320 } },
  ],
};

const CREDENTIA_DIAGRAM: ERDiagram = {
  entities: [
    { id: 'e1', name: 'User', isWeak: false, position: { x: 80, y: 120 } },
    { id: 'e2', name: 'StudentInfo', isWeak: false, position: { x: 760, y: 100 } },
    { id: 'e3', name: 'FacultyInfo', isWeak: false, position: { x: 80, y: 520 } },
    { id: 'e4', name: 'Class', isWeak: false, position: { x: 760, y: 500 } },
    { id: 'e5', name: 'ClassEnrollment', isWeak: true, position: { x: 430, y: 300 } },
  ],
  attributes: [
    { id: 'a1', name: 'id', kind: 'key', entityId: 'e1', position: { x: -50, y: 60 } },
    { id: 'a2', name: 'email', kind: 'regular', entityId: 'e1', position: { x: -85, y: 140 } },
    { id: 'a3', name: 'role', kind: 'regular', entityId: 'e1', position: { x: -30, y: 220 } },
    { id: 'a4', name: 'id', kind: 'key', entityId: 'e2', position: { x: 980, y: 40 } },
    { id: 'a5', name: 'userId', kind: 'regular', entityId: 'e2', position: { x: 980, y: 120 } },
    { id: 'a6', name: 'registrationNumber', kind: 'regular', entityId: 'e2', position: { x: 980, y: 200 } },
    { id: 'a7', name: 'id', kind: 'key', entityId: 'e3', position: { x: -70, y: 640 } },
    { id: 'a8', name: 'userId', kind: 'regular', entityId: 'e3', position: { x: -100, y: 560 } },
    { id: 'a9', name: 'employeeId', kind: 'regular', entityId: 'e3', position: { x: -90, y: 480 } },
    { id: 'a10', name: 'id', kind: 'key', entityId: 'e4', position: { x: 1000, y: 430 } },
    { id: 'a11', name: 'uniqueCode', kind: 'regular', entityId: 'e4', position: { x: 990, y: 520 } },
    { id: 'a12', name: 'facultyId', kind: 'regular', entityId: 'e4', position: { x: 980, y: 610 } },
    { id: 'a13', name: 'id', kind: 'key', entityId: 'e5', position: { x: 360, y: 170 } },
    { id: 'a14', name: 'classId', kind: 'regular', entityId: 'e5', position: { x: 250, y: 330 } },
    { id: 'a15', name: 'studentId', kind: 'regular', entityId: 'e5', position: { x: 610, y: 320 } },
  ],
  relationships: [
    { id: 'r1', name: 'has_student_profile', cardinality: '1:1', entities: ['e1', 'e2'], position: { x: 430, y: 90 } },
    { id: 'r2', name: 'has_faculty_profile', cardinality: '1:1', entities: ['e1', 'e3'], position: { x: 90, y: 320 } },
    { id: 'r3', name: 'teaches', cardinality: '1:N', entities: ['e3', 'e4'], position: { x: 430, y: 520 } },
    { id: 'r4', name: 'enrolls_in', cardinality: 'N:1', entities: ['e5', 'e4'], position: { x: 620, y: 300 } },
    { id: 'r5', name: 'student_enrollment', cardinality: 'N:1', entities: ['e5', 'e2'], position: { x: 620, y: 200 } },
  ],
};

/* ── Page Component ───────────────────────────────────────── */

export default function ERBuilderPage() {
  const store = useERStore();
  const [showSchema, setShowSchema] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const schemaSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showSchema || store.generatedTables.length === 0) return;

    schemaSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showSchema, store.generatedTables.length]);

  const handleConvert = useCallback(() => {
    const diagram = store.getDiagram();
    const tables = erToRelational(diagram);
    store.setGeneratedTables(tables);
    setActiveTableIndex(0);
    setShowSchema(true);
  }, [store]);

  const handleExport = useCallback(() => {
    const el = document.querySelector('.er-canvas-wrapper .react-flow') as HTMLElement | null;
    if (!el) return;
    toPng(el, {
      backgroundColor: '#0c0c0f',
      pixelRatio: 2,
      filter: (node) => {
        if (node?.classList?.contains('react-flow__minimap')) return false;
        if (node?.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'er-diagram.png';
      a.click();
    });
  }, []);

  const handleCopySQL = useCallback(() => {
    const sql = schemasToSQL(store.generatedTables);
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [store.generatedTables]);

  const entityCount = store.entities.length;
  const attrCount = store.attributes.length;
  const relCount = store.relationships.length;
  const safeActiveTableIndex = Math.min(
    activeTableIndex,
    Math.max(0, store.generatedTables.length - 1),
  );
  const activeTable = store.generatedTables[safeActiveTableIndex];
  const activePrimaryKeyCount = activeTable?.columns.filter((column) => column.primaryKey).length ?? 0;
  const activeForeignKeyCount = activeTable?.columns.filter((column) => column.foreignKey).length ?? 0;
  const activeRequiredCount = activeTable?.columns.filter((column) => !column.nullable).length ?? 0;

  const getColumnKeyBadges = (column: NonNullable<typeof activeTable>['columns'][number]) => {
    if (column.primaryKey && column.foreignKey) {
      return [
        { label: 'PK', className: 'bg-amber-500/12 text-amber-300' },
        { label: 'FK', className: 'bg-sky-500/12 text-sky-300' },
      ];
    }

    if (column.primaryKey) {
      return [{ label: 'PK', className: 'bg-amber-500/12 text-amber-300' }];
    }

    if (column.foreignKey) {
      return [{ label: 'FK', className: 'bg-sky-500/12 text-sky-300' }];
    }

    return [{ label: 'Attr', className: 'bg-zinc-800/70 text-zinc-500' }];
  };

  const getColumnReferenceLabel = (column: NonNullable<typeof activeTable>['columns'][number]) => {
    if (!column.foreignKey) return null;
    return `${column.foreignKey.table}.${column.foreignKey.column}`;
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col gap-3 p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl p-2.5"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)' }}
            >
              <Database className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">ER Diagram Builder</h1>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
                  {entityCount} entities
                </span>
                <span className="text-zinc-700">&middot;</span>
                <span>{attrCount} attributes</span>
                <span className="text-zinc-700">&middot;</span>
                <span>{relCount} relationships</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Presets */}
            <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-1 backdrop-blur-sm">
              <button
                onClick={() => store.loadDiagram(UNIVERSITY_DIAGRAM)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-200"
                title="Load University preset"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                University
              </button>
              <button
                onClick={() => store.loadDiagram(BANKING_DIAGRAM)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-200"
                title="Load Banking preset"
              >
                <Landmark className="h-3.5 w-3.5" />
                Banking
              </button>
              <button
                onClick={() => store.loadDiagram(CREDENTIA_DIAGRAM)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-200"
                title="Load Credentia preset"
              >
                <School className="h-3.5 w-3.5" />
                Credentia
              </button>
            </div>

            {/* Toggle panel */}
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-2.5 text-zinc-400 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-200"
              title={showPanel ? 'Hide properties' : 'Show properties'}
            >
              {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>

            {/* Convert */}
            <button
              onClick={handleConvert}
              disabled={entityCount === 0}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/15 transition-all duration-200 hover:shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none"
              style={{
                background: entityCount > 0
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                  : 'rgba(63,63,70,0.5)',
              }}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Convert to Tables
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <ERToolbar onExport={handleExport} />

        {/* Main canvas area */}
        <div className="flex flex-1 gap-3 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 overflow-hidden">
            <ERCanvas />
          </div>

          {/* Properties panel */}
          {showPanel && (
            <div
              className="w-72 shrink-0 overflow-hidden rounded-xl border border-zinc-800/60"
              style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(18,18,21,0.98) 100%)' }}
            >
              <PropertiesPanel />
            </div>
          )}
        </div>

        {/* Generated Schema */}
        {store.generatedTables.length > 0 && (
          <div ref={schemaSectionRef} className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm">
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
            >
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Generated Schema
                </h2>
                <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400">
                  {store.generatedTables.length} tables
                </span>
              </div>
              {showSchema ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </button>

            {showSchema && (
              <div className="space-y-4 border-t border-zinc-800/60 p-5">
                {/* SQL */}
                <div className="relative">
                  <button
                    onClick={handleCopySQL}
                    className="absolute right-3 top-3 rounded-lg border border-zinc-800/60 bg-zinc-900/90 p-2 text-zinc-500 transition-all duration-150 hover:bg-zinc-800 hover:text-zinc-300"
                    title="Copy SQL"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <pre className="overflow-auto rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-5 pr-14 font-mono text-xs leading-relaxed text-zinc-400">
                    {schemasToSQL(store.generatedTables)}
                  </pre>
                </div>

                {/* Tables */}
                <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <aside className="rounded-2xl border border-zinc-800/60 bg-zinc-950/35 p-3">
                    <div className="px-2 pb-3 pt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Tables
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Review the generated schema one table at a time.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {store.generatedTables.map((table, index) => {
                        const foreignKeyCount = table.columns.filter((column) => column.foreignKey).length;
                        const primaryKeyCount = table.columns.filter((column) => column.primaryKey).length;

                        return (
                          <button
                            key={table.name}
                            onClick={() => setActiveTableIndex(index)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                              index === safeActiveTableIndex
                                ? 'border-violet-500/40 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.18)]'
                                : 'border-zinc-800/60 bg-zinc-900/45 hover:border-zinc-700 hover:bg-zinc-900/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-100">{table.name}</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {table.columns.length} columns
                                </p>
                              </div>
                              <span className="rounded-full border border-zinc-800/80 px-2 py-1 text-[10px] font-bold text-zinc-400">
                                {index + 1}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                              <span className="rounded-full bg-zinc-800/80 px-2 py-1">
                                {primaryKeyCount} PK
                              </span>
                              <span className="rounded-full bg-zinc-800/80 px-2 py-1">
                                {foreignKeyCount} FK
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </aside>

                  {activeTable && (
                    <section className="overflow-hidden rounded-[1.35rem] border border-zinc-800/60 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(16,16,20,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                      <div className="border-b border-zinc-800/60 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_38%),linear-gradient(180deg,rgba(39,39,42,0.55),rgba(24,24,27,0.2))] px-5 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
                              <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
                              Table {safeActiveTableIndex + 1} of {store.generatedTables.length}
                            </div>
                            <h3 className="mt-3 text-2xl font-bold tracking-tight text-zinc-50">{activeTable.name}</h3>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                              Inspect each generated relation before moving to the next one. Primary keys, foreign keys, and required columns are highlighted in a cleaner schema layout.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start">
                            <button
                              onClick={() => setActiveTableIndex((current) => Math.max(0, current - 1))}
                              disabled={safeActiveTableIndex === 0}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </button>
                            <button
                              onClick={() => setActiveTableIndex((current) => Math.min(store.generatedTables.length - 1, current + 1))}
                              disabled={safeActiveTableIndex === store.generatedTables.length - 1}
                              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/12 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/18 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/35 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Columns</p>
                            <p className="mt-2 text-2xl font-bold text-zinc-50">{activeTable.columns.length}</p>
                          </div>
                          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/35 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Primary Keys</p>
                            <p className="mt-2 text-2xl font-bold text-zinc-50">{activePrimaryKeyCount}</p>
                          </div>
                          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/35 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Foreign Keys</p>
                            <p className="mt-2 text-2xl font-bold text-zinc-50">{activeForeignKeyCount}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                            {activeRequiredCount} required
                          </span>
                          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-violet-200">
                            {activeTable.columns.length - activeRequiredCount} nullable
                          </span>
                          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">
                            {activeForeignKeyCount > 0 ? 'references other tables' : 'standalone relation'}
                          </span>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/30">
                          <div className="hidden md:block">
                            <table className="w-full table-fixed border-collapse">
                              <colgroup>
                                <col className="w-[29%]" />
                                <col className="w-[13%]" />
                                <col className="w-[16%]" />
                                <col className="w-[24%]" />
                                <col className="w-[18%]" />
                              </colgroup>
                              <thead>
                                <tr className="border-b border-zinc-800/60 bg-zinc-900/70 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                  <th className="px-6 py-3 text-left">Column</th>
                                  <th className="px-6 py-3 text-center">Type</th>
                                  <th className="px-6 py-3 text-left">Key</th>
                                  <th className="px-6 py-3 text-left">Reference</th>
                                  <th className="px-6 py-3 text-center">Required</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeTable.columns.map((column) => (
                                  <tr key={column.name} className="border-b border-zinc-800/60 last:border-b-0 align-middle">
                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex min-h-14 items-center">
                                        <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">
                                          {column.name}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex min-h-14 items-center justify-center">
                                        <span className="inline-flex min-w-[104px] items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/90 px-3 py-1.5 text-xs font-semibold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                          {column.type}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex min-h-14 items-center">
                                        <div className="inline-flex min-h-11 min-w-[116px] flex-wrap items-center gap-1.5">
                                          {getColumnKeyBadges(column).map((badge) => (
                                            <span key={badge.label} className={`inline-flex min-w-[46px] items-center justify-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${badge.className}`}>
                                              {badge.label}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex min-h-14 items-center">
                                        {getColumnReferenceLabel(column) ? (
                                          <span className="truncate text-sm text-zinc-400">
                                            {getColumnReferenceLabel(column)}
                                          </span>
                                        ) : (
                                          <span className="text-sm text-zinc-600">No reference</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex min-h-14 items-center justify-center">
                                        <span className={`inline-flex min-w-[112px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${column.nullable ? 'border border-zinc-800/80 bg-zinc-900/85 text-zinc-400' : 'border border-emerald-500/15 bg-emerald-500/12 text-emerald-300'}`}>
                                          {column.nullable ? 'Optional' : 'Required'}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="divide-y divide-zinc-800/60 md:hidden">
                            {activeTable.columns.map((column) => (
                              <div key={column.name}>
                                <div className="space-y-3 px-4 py-4 md:hidden">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold tracking-tight text-zinc-100">{column.name}</p>
                                      <p className="mt-1 text-xs text-zinc-500">{column.type}</p>
                                    </div>
                                    <div className="inline-flex flex-wrap justify-end gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                      {getColumnKeyBadges(column).map((badge) => (
                                        <span key={badge.label} className={`inline-flex min-w-[42px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
                                          {badge.label}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-medium ${column.nullable ? 'border border-zinc-800/80 bg-zinc-900/85 text-zinc-400' : 'border border-emerald-500/15 bg-emerald-500/12 text-emerald-300'}`}>
                                      {column.nullable ? 'Optional' : 'Required'}
                                    </span>
                                    {column.foreignKey && (
                                      <span className="inline-flex items-center rounded-full border border-sky-500/15 bg-sky-500/10 px-3 py-1.5 text-sky-200">
                                        {column.foreignKey.table}.{column.foreignKey.column}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
