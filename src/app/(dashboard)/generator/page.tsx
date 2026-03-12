'use client';

import { useState, useCallback, useRef } from 'react';
import { useGeneratorStore } from '@/stores/generator-store';
import {
  TABLE_TEMPLATES,
  type ColumnType,
  type SemanticHint,
} from '@/lib/engine/data-generator';
import { cn } from '@/lib/utils/helpers';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight,
  ClipboardPaste,
  RotateCcw,
  GraduationCap,
  Building2,
  ShoppingCart,
  Stethoscope,
  Users,
  Table2,
  Wand2,
  FileCode,
} from 'lucide-react';
import Link from 'next/link';

/* ── Constants ───────────────────────────────────────────── */

const TYPE_OPTIONS: { value: ColumnType; label: string; color: string }[] = [
  { value: 'integer', label: 'INTEGER', color: 'text-amber-400 bg-amber-500/15' },
  { value: 'text', label: 'TEXT', color: 'text-blue-400 bg-blue-500/15' },
  { value: 'real', label: 'REAL', color: 'text-emerald-400 bg-emerald-500/15' },
  { value: 'date', label: 'DATE', color: 'text-cyan-400 bg-cyan-500/15' },
  { value: 'boolean', label: 'BOOLEAN', color: 'text-pink-400 bg-pink-500/15' },
];

const HINT_OPTIONS: { value: SemanticHint; label: string; group: string }[] = [
  { value: 'auto', label: 'Auto-detect', group: 'General' },
  { value: 'id', label: 'ID (1, 2, 3…)', group: 'General' },
  { value: 'uuid', label: 'UUID', group: 'General' },
  { value: 'boolean', label: 'Boolean', group: 'General' },
  { value: 'name', label: 'Full Name', group: 'Person' },
  { value: 'first_name', label: 'First Name', group: 'Person' },
  { value: 'last_name', label: 'Last Name', group: 'Person' },
  { value: 'email', label: 'Email', group: 'Person' },
  { value: 'phone', label: 'Phone', group: 'Person' },
  { value: 'username', label: 'Username', group: 'Person' },
  { value: 'age', label: 'Age (18–65)', group: 'Person' },
  { value: 'gender', label: 'Gender', group: 'Person' },
  { value: 'gpa', label: 'GPA (X.X)', group: 'Academic' },
  { value: 'cgpa', label: 'CGPA (X.XX)', group: 'Academic' },
  { value: 'grade', label: 'Grade (A+, B…)', group: 'Academic' },
  { value: 'credits', label: 'Credits (1–5)', group: 'Academic' },
  { value: 'semester', label: 'Semester', group: 'Academic' },
  { value: 'course_name', label: 'Course Name', group: 'Academic' },
  { value: 'department', label: 'Department', group: 'Academic' },
  { value: 'salary', label: 'Salary', group: 'Finance' },
  { value: 'price', label: 'Price', group: 'Finance' },
  { value: 'balance', label: 'Balance', group: 'Finance' },
  { value: 'quantity', label: 'Quantity', group: 'Finance' },
  { value: 'percentage', label: 'Percentage', group: 'Finance' },
  { value: 'rating', label: 'Rating (1–5)', group: 'Finance' },
  { value: 'date', label: 'Date', group: 'Other' },
  { value: 'year', label: 'Year', group: 'Other' },
  { value: 'address', label: 'Address', group: 'Other' },
  { value: 'city', label: 'City', group: 'Other' },
  { value: 'country', label: 'Country', group: 'Other' },
  { value: 'status', label: 'Status', group: 'Other' },
  { value: 'title', label: 'Job Title', group: 'Other' },
  { value: 'description', label: 'Description', group: 'Other' },
  { value: 'url', label: 'URL', group: 'Other' },
  { value: 'company', label: 'Company', group: 'Other' },
  { value: 'building', label: 'Building', group: 'Other' },
  { value: 'room_number', label: 'Room Number', group: 'Other' },
  { value: 'isbn', label: 'ISBN', group: 'Other' },
];

const TEMPLATE_ICONS: Record<string, typeof GraduationCap> = {
  students: GraduationCap,
  employees: Users,
  ecommerce: ShoppingCart,
  university: Building2,
  hospital: Stethoscope,
};

/* ── Page ─────────────────────────────────────────────────── */

export default function GeneratorPage() {
  const store = useGeneratorStore();
  const [copied, setCopied] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set([0]));
  const sqlRef = useRef<HTMLPreElement>(null);

  const handleGenerate = useCallback(() => {
    store.generate();
    setShowSQL(true);
  }, [store]);

  const handleCopy = useCallback(() => {
    if (!store.generatedSQL) return;
    navigator.clipboard.writeText(store.generatedSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [store.generatedSQL]);

  const toggleTable = (index: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAddTable = () => {
    const name = `table_${store.tables.length + 1}`;
    store.addTable(name);
    setExpandedTables((prev) => new Set(prev).add(store.tables.length));
  };

  const handleLoadTemplate = (template: typeof TABLE_TEMPLATES[number]) => {
    store.loadTemplate(template.tables);
    setExpandedTables(new Set(template.tables.map((_, i) => i)));
    setShowSQL(false);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-violet-500/25"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)' }}
          >
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Table Generator</h1>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
                {store.tables.length} table{store.tables.length !== 1 ? 's' : ''}
              </span>
              <span className="text-zinc-700">&middot;</span>
              <span>{store.tables.reduce((a, t) => a + t.columns.length, 0)} columns</span>
              <span className="text-zinc-700">&middot;</span>
              <span>Smart data generation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={store.tables.length === 0 || store.tables.every((t) => t.columns.length === 0)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/15 transition-all duration-200 hover:shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none"
            style={{
              background:
                store.tables.length > 0
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                  : 'rgba(63,63,70,0.5)',
            }}
          >
            <Wand2 className="h-4 w-4" />
            Generate SQL
          </button>

          {/* Clear */}
          <button
            onClick={() => { store.clear(); setShowSQL(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Quick Start:</span>
        {TABLE_TEMPLATES.map((tmpl) => {
          const Icon = TEMPLATE_ICONS[tmpl.name] || Database;
          return (
            <button
              key={tmpl.name}
              onClick={() => handleLoadTemplate(tmpl)}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
              title={tmpl.description}
            >
              <Icon className="h-3.5 w-3.5" />
              {tmpl.label}
            </button>
          );
        })}
      </div>

      {/* Main Area */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        {/* Left: Table Definitions */}
        <div className="flex flex-col gap-3 overflow-auto">
          {store.tables.map((table, ti) => {
            const isExpanded = expandedTables.has(ti);
            return (
              <div
                key={ti}
                className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm"
              >
                {/* Table Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleTable(ti)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <Table2 className="h-4 w-4 text-violet-400" />

                  <input
                    type="text"
                    value={table.name}
                    onChange={(e) => store.updateTableName(ti, e.target.value)}
                    className="flex-1 bg-transparent font-mono text-sm font-semibold text-zinc-200 outline-none placeholder:text-zinc-600 focus:text-violet-300"
                    placeholder="table_name"
                  />

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      Rows:
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={table.rowCount}
                        onChange={(e) => store.updateTableRowCount(ti, Number(e.target.value))}
                        className="w-16 rounded-lg border border-zinc-700/50 bg-zinc-950/60 px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                    </label>
                    {store.tables.length > 1 && (
                      <button
                        onClick={() => store.removeTable(ti)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-all hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Columns */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/40 px-4 py-3">
                    {/* Column headers */}
                    <div className="mb-2 grid grid-cols-[1fr_90px_120px_40px_28px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      <span>Column Name</span>
                      <span>Type</span>
                      <span>Data Pattern</span>
                      <span className="text-center">PK</span>
                      <span />
                    </div>

                    <div className="space-y-1.5">
                      {table.columns.map((col, ci) => {
                        const typeOpt = TYPE_OPTIONS.find((t) => t.value === col.type);
                        return (
                          <div
                            key={ci}
                            className="group grid grid-cols-[1fr_90px_120px_40px_28px] items-center gap-2 rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-2 py-1.5 transition-colors hover:border-zinc-700/60"
                          >
                            {/* Name */}
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => store.updateColumn(ti, ci, { name: e.target.value })}
                              className="w-full bg-transparent font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                              placeholder="column_name"
                            />

                            {/* Type selector */}
                            <select
                              value={col.type}
                              onChange={(e) => store.updateColumn(ti, ci, { type: e.target.value as ColumnType })}
                              className={cn(
                                'cursor-pointer appearance-none rounded-lg px-2 py-1 text-[11px] font-medium outline-none',
                                typeOpt?.color || 'text-zinc-400 bg-zinc-800',
                              )}
                            >
                              {TYPE_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>

                            {/* Hint selector */}
                            <select
                              value={col.hint}
                              onChange={(e) => store.updateColumn(ti, ci, { hint: e.target.value as SemanticHint })}
                              className="cursor-pointer appearance-none rounded-lg bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400 outline-none hover:text-zinc-200"
                            >
                              {(() => {
                                const groups: Record<string, typeof HINT_OPTIONS> = {};
                                HINT_OPTIONS.forEach((h) => {
                                  (groups[h.group] ??= []).push(h);
                                });
                                return Object.entries(groups).map(([group, hints]) => (
                                  <optgroup key={group} label={group}>
                                    {hints.map((h) => (
                                      <option key={h.value} value={h.value}>
                                        {h.label}
                                      </option>
                                    ))}
                                  </optgroup>
                                ));
                              })()}
                            </select>

                            {/* PK */}
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={col.primaryKey}
                                onChange={(e) => store.updateColumn(ti, ci, { primaryKey: e.target.checked })}
                                className="h-3.5 w-3.5 cursor-pointer rounded"
                              />
                            </div>

                            {/* Remove */}
                            {table.columns.length > 1 && (
                              <button
                                onClick={() => store.removeColumn(ti, ci)}
                                className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => store.addColumn(ti)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-violet-300"
                    >
                      <Plus className="h-3 w-3" /> Add Column
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add table button */}
          <button
            onClick={handleAddTable}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/50 py-3 text-sm text-zinc-500 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-violet-300"
          >
            <Plus className="h-4 w-4" />
            Add Table
          </button>
        </div>

        {/* Right: Generated SQL Output */}
        <div className="flex flex-col gap-3 overflow-auto">
          {!showSQL || !store.generatedSQL ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
                <FileCode className="h-8 w-8 text-violet-400/50" />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-300">No SQL Generated Yet</h3>
              <p className="max-w-xs text-xs text-zinc-500">
                Define your tables on the left, then click <strong>Generate SQL</strong> to create
                CREATE TABLE and INSERT statements with realistic sample data.
              </p>
              <div className="mt-6 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-left">
                <p className="mb-2 text-[11px] font-medium text-zinc-400">Data pattern examples:</p>
                <div className="space-y-1 text-[11px] text-zinc-500">
                  <p><span className="text-amber-400">cgpa</span> → 7.84, 8.23, 6.91</p>
                  <p><span className="text-blue-400">email</span> → alice.johnson@gmail.com</p>
                  <p><span className="text-emerald-400">salary</span> → 75000, 92400</p>
                  <p><span className="text-cyan-400">grade</span> → A+, B, A-</p>
                  <p><span className="text-pink-400">gpa</span> → 3.8, 2.9, 3.5</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm">
              {/* SQL Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/40 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Generated SQL</h2>
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {store.generatedSQL.split('\n').length} lines
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-200"
                    title="Copy SQL to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy SQL
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* SQL Code */}
              <div className="flex-1 overflow-auto p-5">
                <pre
                  ref={sqlRef}
                  className="font-mono text-xs leading-relaxed text-zinc-400 selection:bg-violet-500/30"
                >
                  {store.generatedSQL}
                </pre>
              </div>

              {/* Import Actions */}
              <div className="border-t border-zinc-800/40 px-5 py-3">
                <p className="mb-2 text-[11px] font-medium text-zinc-500">
                  Import generated tables into:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/sandbox"
                    onClick={() => {
                      if (store.generatedSQL) {
                        navigator.clipboard.writeText(store.generatedSQL);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    SQL Sandbox
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/er-builder"
                    onClick={() => {
                      if (store.generatedSQL) {
                        navigator.clipboard.writeText(store.generatedSQL);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    ER Builder
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="mt-2 text-[10px] text-zinc-600">
                  SQL is copied to clipboard. In SQL Sandbox, use Import SQL to paste it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
