'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import { useLoadingStore } from '@/stores/loading-store';
import { SqlEditor } from '@/components/sandbox/sql-editor';
import { SchemaBrowser } from '@/components/sandbox/schema-browser';

import { CreateTableModal } from '@/components/algebra/create-table-modal';
import { ResultPanel } from '@/components/visual/result-panel';
import { SqlErrorAlert } from '@/components/visual/sql-error-alert';
import { cn } from '@/lib/utils/helpers';
import type { QueryResult } from '@/types/database';
import {
  Terminal,
  Database,
  UserRound,
  Shield,
  ScrollText,
  ChevronDown,
  Play,
  Download,
  Plus,
  ClipboardPaste,
  RotateCcw,
  CheckCircle2,
  Table2,
  History,
  ListTree,
  X,
} from 'lucide-react';
import Link from 'next/link';

import universityData from '@/../seed/datasets/university.json';
import bankingData from '@/../seed/datasets/banking.json';

function jsonToSQL(data: Record<string, Record<string, unknown>[]>): string {
  const statements: string[] = [];
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const colDefs = cols.map((c) => {
      const sample = rows[0][c];
      const t = typeof sample === 'number' ? (Number.isInteger(sample) ? 'INTEGER' : 'REAL') : 'TEXT';
      return `"${c}" ${t}${c === 'id' ? ' PRIMARY KEY' : ''}`;
    });
    statements.push(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')});`);
    for (const row of rows) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      statements.push(`INSERT INTO "${table}" VALUES (${vals.join(', ')});`);
    }
  }
  return statements.join('\n');
}

export default function SandboxPage() {
  const {
    isReady,
    execute,
    loadSQL,
    reset,
    exportCSV,
    tables,
    refreshTables,
    databases,
    activeDatabase,
    switchDatabase,
    users,
    activeUser,
    switchUser,
  } = useSqlEngine();
  const store = useSandboxStore();
  const { start: startLoading, stop: stopLoading } = useLoadingStore();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [importErrorResult, setImportErrorResult] = useState<QueryResult | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showDatabases, setShowDatabases] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [editorFeedback, setEditorFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [showTriggersPanel, setShowTriggersPanel] = useState(false);
  const [triggerRows, setTriggerRows] = useState<Array<{ Trigger: string; Table: string; Statement: string }>>([]);
  const [triggerQueryError, setTriggerQueryError] = useState<string | null>(null);
  const [triggerQueryMs, setTriggerQueryMs] = useState<number | null>(null);
  const [showProceduresPanel, setShowProceduresPanel] = useState(false);
  const [procedureRows, setProcedureRows] = useState<Array<{ Db: string; Name: string; Type: string }>>([]);
  const [procedureQueryError, setProcedureQueryError] = useState<string | null>(null);
  const [procedureQueryMs, setProcedureQueryMs] = useState<number | null>(null);
  const [selectedProcedureName, setSelectedProcedureName] = useState<string | null>(null);
  const [selectedProcedureSql, setSelectedProcedureSql] = useState<string | null>(null);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [selectedSecurityUser, setSelectedSecurityUser] = useState<string>('');
  const [grantsRows, setGrantsRows] = useState<string[]>([]);
  const [grantsQueryError, setGrantsQueryError] = useState<string | null>(null);
  const [grantsQueryMs, setGrantsQueryMs] = useState<number | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const defaultsBootstrappedRef = useRef(false);

  const triggerEditorFeedback = useCallback((feedback: 'success' | 'error') => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setEditorFeedback(feedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      setEditorFeedback('idle');
      feedbackTimeoutRef.current = null;
    }, 700);
  }, []);

  // Auto-save session
  const { save } = useSessionPersistence();
  useEffect(() => {
    save({ lastPage: 'sandbox' });
  }, [save]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showTriggersPanel && !showProceduresPanel && !showSecurityPanel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTriggersPanel(false);
        setShowProceduresPanel(false);
        setShowSecurityPanel(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showProceduresPanel, showSecurityPanel, showTriggersPanel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dbMenuRef.current) return;
      const target = event.target as Node;

      if (!dbMenuRef.current.contains(target)) {
        setShowDatabases(false);
      }

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUsers(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isReady) {
      defaultsBootstrappedRef.current = false;
      return;
    }

    if (defaultsBootstrappedRef.current) return;
    defaultsBootstrappedRef.current = true;

    const bootstrapDefaults = () => {
      const initialActive = activeDatabase;

      const defaults = [
        { name: 'university', data: universityData as Record<string, unknown> },
        { name: 'banking', data: bankingData as Record<string, unknown> },
      ];

      defaults.forEach((dataset) => {
        const createDb = execute(`CREATE DATABASE IF NOT EXISTS "${dataset.name}"`, { persist: false });
        if (createDb.error) return;

        const useDb = switchDatabase(dataset.name);
        if (useDb.error) return;

        const tableCheck = execute('SHOW TABLES;');
        const hasTables = !tableCheck.error && tableCheck.rowCount > 0;
        if (hasTables) return;

        const sql = jsonToSQL(dataset.data as Record<string, Record<string, unknown>[]>);
        loadSQL(sql, { persist: false });
      });

      // Cleanup for default dataset tables that accidentally landed in `main`.
      // We only remove known default tables and only when they exist in their target DBs.
      const parseTableNames = (res: QueryResult): Set<string> => {
        if (res.error || res.rowCount === 0) return new Set();
        const names = new Set<string>();
        for (const row of res.rows) {
          const firstVal = Object.values(row)[0];
          if (typeof firstVal === 'string' && firstVal.trim()) names.add(firstVal);
        }
        return names;
      };

      const datasetTableMap = new Map<string, Set<string>>();
      for (const dataset of defaults) {
        const switched = switchDatabase(dataset.name);
        if (switched.error) continue;
        const rows = execute('SHOW TABLES;');
        datasetTableMap.set(dataset.name, parseTableNames(rows));
      }

      const switchedMain = switchDatabase('main');
      if (!switchedMain.error) {
        const mainTables = parseTableNames(execute('SHOW TABLES;'));

        const knownDefaultTables = new Set<string>();
        for (const dataset of defaults) {
          for (const table of Object.keys(dataset.data as Record<string, unknown>)) {
            knownDefaultTables.add(table);
          }
        }

        for (const tableName of knownDefaultTables) {
          if (!mainTables.has(tableName)) continue;

          const existsInTargetDb = Array.from(datasetTableMap.values()).some((set) => set.has(tableName));
          if (!existsInTargetDb) continue;

          execute(`DROP TABLE IF EXISTS "${tableName}";`, { persist: false });
        }
      }

      const switchedBack = switchDatabase(initialActive);
      if (switchedBack.error) switchDatabase('main');
    };

    bootstrapDefaults();
  }, [activeDatabase, databases, execute, isReady, loadSQL, switchDatabase]);

  const handleExecute = useCallback(() => {
    const q = store.query.trim();
    if (!q) return;
    const res = execute(q);
    setResult(res);
    store.setResults(res);
    store.addToHistory(q, !res.error, res);
    triggerEditorFeedback(res.error ? 'error' : 'success');
    if (!res.error) {
      store.setQuery('');
    }
  }, [execute, store, triggerEditorFeedback]);

  const handleImportSQL = useCallback(() => {
    setImportErrorResult(null);
    const sql = importSql.trim();
    if (!sql) return;
    const res = loadSQL(sql);
    setResult(res);
    if (res.error) {
      setImportErrorResult(res);
      return;
    }
    setShowImport(false);
    setImportSql('');
    const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
    if (tableMatch) {
      store.setQuery(`SELECT * FROM "${tableMatch[1]}" LIMIT 20;`);
    }
  }, [importSql, loadSQL, store]);

  const handleExportCSV = useCallback(() => {
    if (!result || result.columns.length === 0) return;
    const csv = exportCSV(result);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [result, exportCSV]);

  const loadTriggers = useCallback(() => {
    const triggerResult = execute('SHOW TRIGGERS;');
    if (triggerResult.error) {
      setTriggerRows([]);
      setTriggerQueryMs(null);
      setTriggerQueryError(triggerResult.error);
      return;
    }

    const rows = triggerResult.rows.map((row) => ({
      Trigger: String(row.Trigger ?? ''),
      Table: String(row.Table ?? ''),
      Statement: String(row.Statement ?? ''),
    }));

    setTriggerRows(rows);
    setTriggerQueryMs(triggerResult.executionTimeMs);
    setTriggerQueryError(null);
  }, [execute]);

  const loadProcedures = useCallback(() => {
    const procedureResult = execute('SHOW PROCEDURE STATUS;');
    if (procedureResult.error) {
      setProcedureRows([]);
      setProcedureQueryMs(null);
      setProcedureQueryError(procedureResult.error);
      return;
    }

    const rows = procedureResult.rows.map((row) => ({
      Db: String(row.Db ?? ''),
      Name: String(row.Name ?? ''),
      Type: String(row.Type ?? 'PROCEDURE'),
    }));

    setProcedureRows(rows);
    setProcedureQueryMs(procedureResult.executionTimeMs);
    setProcedureQueryError(null);
  }, [execute]);

  const loadProcedureDefinition = useCallback(
    (proc: { Db: string; Name: string }) => {
      const qualifiedName = proc.Db ? `${proc.Db}.${proc.Name}` : proc.Name;
      const definitionResult = execute(`SHOW CREATE PROCEDURE ${qualifiedName};`);
      if (definitionResult.error) {
        setSelectedProcedureName(qualifiedName);
        setSelectedProcedureSql(`Error: ${definitionResult.error}`);
        return;
      }

      const row = definitionResult.rows[0] ?? {};
      const definition =
        (row['Create Procedure'] as string | undefined) ??
        (Object.entries(row).find(([key]) => key.toLowerCase().includes('create'))?.[1] as
          | string
          | undefined) ??
        '';

      setSelectedProcedureName(qualifiedName);
      setSelectedProcedureSql(String(definition));
    },
    [execute],
  );

  const toSqlUserSpec = useCallback((userDisplay: string): string => {
    const trimmed = userDisplay.trim();
    if (!trimmed) return "'admin'@'localhost'";
    if (trimmed.includes('@')) {
      const [username, host] = trimmed.split('@');
      return `'${username || 'admin'}'@'${host || 'localhost'}'`;
    }
    return `'${trimmed}'@'localhost'`;
  }, []);

  const loadGrantsForUser = useCallback(
    (userDisplay: string) => {
      const grantsResult = execute(`SHOW GRANTS FOR ${toSqlUserSpec(userDisplay)};`);
      if (grantsResult.error) {
        setGrantsRows([]);
        setGrantsQueryMs(null);
        setGrantsQueryError(grantsResult.error);
        return;
      }

      const rows = grantsResult.rows.map((row) => String(Object.values(row)[0] ?? ''));
      setGrantsRows(rows);
      setGrantsQueryMs(grantsResult.executionTimeMs);
      setGrantsQueryError(null);
    },
    [execute, toSqlUserSpec],
  );

  const runWithActionLoading = useCallback(
    async (message: string, action: () => void) => {
      startLoading(message);
      try {
        action();
        await new Promise((resolve) => setTimeout(resolve, 420));
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  const handleClearInputOutput = useCallback(async () => {
    await runWithActionLoading('Clearing editor and output…', () => {
      store.setQuery('');
      store.setResults(null);
      setResult(null);
    });
  }, [runWithActionLoading, store]);

  const handleResetWorkspace = useCallback(async () => {
    await runWithActionLoading('Resetting sandbox workspace…', () => {
      reset();
      store.setQuery('');
      store.setResults(null);
      store.clearHistory();
      setResult(null);
      setShowImport(false);
      setImportSql('');
      setImportErrorResult(null);
      setShowDatabases(false);
      setShowUsers(false);
      setShowTriggersPanel(false);
      setShowProceduresPanel(false);
      setShowSecurityPanel(false);
      setTriggerRows([]);
      setTriggerQueryError(null);
      setTriggerQueryMs(null);
      setProcedureRows([]);
      setProcedureQueryError(null);
      setProcedureQueryMs(null);
      setSelectedProcedureName(null);
      setSelectedProcedureSql(null);
      setSelectedSecurityUser('');
      setGrantsRows([]);
      setGrantsQueryError(null);
      setGrantsQueryMs(null);
    });
  }, [reset, runWithActionLoading, store]);

  const tableCount = tables.length;
  const historyCount = store.queryHistory.length;

  return (
    <>
      <div className="flex h-full flex-col gap-3 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-emerald-500/25"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)' }}
            >
              <Terminal className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">SQL Sandbox</h1>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {tableCount} table{tableCount !== 1 ? 's' : ''}
                </span>
                <span className="text-zinc-700">&middot;</span>
                <span>{historyCount} queries run</span>
                <span className="text-zinc-700">&middot;</span>
                <span className="text-zinc-600">MySQL-compatible</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Databases dropdown */}
            <div className="relative" ref={dbMenuRef}>
              <button
                onClick={() => {
                  setShowUsers(false);
                  setShowDatabases((v) => !v);
                }}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 disabled:opacity-40"
              >
                <Database className="h-3.5 w-3.5 text-sky-300" />
                Databases
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400">
                  {activeDatabase}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>

              {showDatabases && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Available databases
                  </div>
                  <div className="space-y-1">
                    {databases.map((dbName) => {
                      const normalizedDbName = dbName.toLowerCase();
                      const isSystemDb = normalizedDbName === 'main' || normalizedDbName === 'university' || normalizedDbName === 'banking';
                      const isActiveDb = activeDatabase === dbName;
                      return (
                        <button
                          key={dbName}
                          onClick={() => {
                            const res = switchDatabase(dbName);
                            if (!res.error) {
                              setShowDatabases(false);
                            }
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all',
                            isActiveDb
                              ? isSystemDb
                                ? 'border-sky-500/35 bg-sky-500/12 text-sky-100'
                                : 'border-violet-500/35 bg-violet-500/14 text-violet-100'
                              : isSystemDb
                                ? 'border-zinc-800/70 bg-zinc-900/60 text-zinc-300 hover:border-sky-500/25 hover:bg-sky-500/8'
                                : 'border-zinc-800/70 bg-zinc-900/60 text-zinc-300 hover:border-violet-500/25 hover:bg-violet-500/8',
                          )}
                        >
                          <span className="truncate font-medium">{dbName}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              isSystemDb
                                ? 'bg-sky-500/15 text-sky-300'
                                : 'bg-violet-500/15 text-violet-300',
                            )}
                          >
                            {isSystemDb ? 'system' : 'user'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Users dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setShowDatabases(false);
                  setShowUsers((v) => !v);
                }}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 disabled:opacity-40"
              >
                <UserRound className="h-3.5 w-3.5 text-amber-300" />
                Users
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400">
                  {activeUser}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>

              {showUsers && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Available users
                  </div>
                  <div className="space-y-1">
                    {users.map((userName) => {
                      const normalizedUser = userName.toLowerCase();
                      const isAdmin = normalizedUser === 'admin' || normalizedUser === 'admin@localhost';
                      const isActive = activeUser.toLowerCase() === normalizedUser;
                      return (
                        <button
                          key={userName}
                          onClick={() => {
                            const res = switchUser(userName);
                            if (!res.error) {
                              setShowUsers(false);
                            }
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all',
                            isActive
                              ? isAdmin
                                ? 'border-amber-500/35 bg-amber-500/12 text-amber-100'
                                : 'border-teal-500/35 bg-teal-500/14 text-teal-100'
                              : isAdmin
                                ? 'border-zinc-800/70 bg-zinc-900/60 text-zinc-300 hover:border-amber-500/25 hover:bg-amber-500/8'
                                : 'border-zinc-800/70 bg-zinc-900/60 text-zinc-300 hover:border-teal-500/25 hover:bg-teal-500/8',
                          )}
                        >
                          <span className="truncate font-medium">{userName}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              isAdmin
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-teal-500/15 text-teal-300',
                            )}
                          >
                            {isAdmin ? 'admin' : 'user'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mx-0.5 h-5 w-px bg-zinc-700/50" />

            {/* Create Table */}
            <button
              onClick={() => setCreateOpen(true)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>

            {/* Import SQL */}
            <button
              onClick={() => setShowImport(!showImport)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20 disabled:opacity-40"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Import SQL
            </button>

            {/* Triggers */}
            <button
              onClick={() => {
                if (!showTriggersPanel) {
                  loadTriggers();
                }
                setShowTriggersPanel((v) => !v);
              }}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-300 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/20 disabled:opacity-40"
            >
              <ListTree className="h-3.5 w-3.5" />
              Triggers
              {triggerRows.length > 0 && (
                <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                  {triggerRows.length}
                </span>
              )}
            </button>

            {/* Procedures */}
            <button
              onClick={() => {
                if (!showProceduresPanel) {
                  loadProcedures();
                }
                setShowProceduresPanel((v) => !v);
              }}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-medium text-fuchsia-300 transition-all hover:border-fuchsia-500/50 hover:bg-fuchsia-500/20 disabled:opacity-40"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Procedures
              {procedureRows.length > 0 && (
                <span className="rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200">
                  {procedureRows.length}
                </span>
              )}
            </button>

            {/* Security */}
            <button
              onClick={() => {
                if (!showSecurityPanel) {
                  const seedUser = activeUser || users[0] || 'admin@localhost';
                  setSelectedSecurityUser(seedUser);
                  loadGrantsForUser(seedUser);
                }
                setShowSecurityPanel((v) => !v);
              }}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300 transition-all hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
            >
              <Shield className="h-3.5 w-3.5" />
              Security
            </button>

            {/* Clear */}
            <button
              onClick={handleClearInputOutput}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10 active:scale-95"
            >
              Clear
            </button>

            {/* Reset */}
            <button
              onClick={handleResetWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Import SQL Panel */}
        {showImport && (
          <div className="rounded-xl border border-violet-500/30 bg-zinc-900/80 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Import SQL</h3>
              <p className="text-[11px] text-zinc-500">Paste CREATE TABLE / INSERT statements from Table Generator</p>
            </div>
            <textarea
              value={importSql}
              onChange={(e) => {
                setImportSql(e.target.value);
                if (importErrorResult) setImportErrorResult(null);
              }}
              placeholder={'-- Paste your SQL here\nCREATE TABLE "students" (\n  "id" INTEGER PRIMARY KEY,\n  "name" TEXT\n);'}
              className="w-full rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-4 py-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
              rows={6}
            />
            {importErrorResult?.error && (
              <SqlErrorAlert
                error={importErrorResult.error}
                details={importErrorResult.errorDetails}
                compact
                className="mt-2"
              />
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleImportSQL}
                disabled={!importSql.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:opacity-40"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Run Import
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportSql('');
                  setImportErrorResult(null);
                }}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Engine Status */}
        {!isReady && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-sm text-zinc-400">Initializing SQL engine…</span>
          </div>
        )}

        {/* Available Tables */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => store.setQuery(`SELECT * FROM "${t.name}" LIMIT 20;`)}
                title={`Query "${t.name}"`}
                className="group inline-flex items-center gap-1 rounded-md border border-zinc-700/40 bg-zinc-800/50 px-2.5 py-1 font-mono text-xs text-zinc-300 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <Table2 className="h-3 w-3 text-zinc-500 transition-colors group-hover:text-emerald-400" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-4">
          {/* Editor + Results */}
          <div className="flex flex-col gap-3 overflow-auto lg:col-span-3">
            <SqlEditor
              value={store.query}
              onChange={store.setQuery}
              onExecute={handleExecute}
              tables={tables}
              executionFeedback={editorFeedback}
              hasOutput={Boolean(result)}
            />

            {/* Run bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition-all duration-200 hover:shadow-emerald-500/25 disabled:opacity-40 disabled:shadow-none"
                style={{
                  background: isReady
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(63,63,70,0.5)',
                }}
              >
                <Play className="h-4 w-4" />
                Run Query
              </button>
              {result && result.columns.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 px-4 py-2 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              )}
            </div>

            {/* Error */}
            {result?.error && (
              <SqlErrorAlert error={result.error} details={result.errorDetails} />
            )}

            {/* Results table */}
            {result && !result.error && result.columns.length > 0 && (
              <ResultPanel
                columns={result.columns}
                rows={result.rows}
                rowCount={result.rowCount}
                executionTimeMs={result.executionTimeMs}
              />
            )}

            {/* Success message (no columns) */}
            {result && !result.error && result.columns.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Query executed successfully.{' '}
                  {result.rowCount > 0 ? `${result.rowCount} row(s) affected.` : 'No rows returned.'}{' '}
                  ({result.executionTimeMs.toFixed(1)}ms)
                </span>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3 overflow-auto">
            <SchemaBrowser tables={tables} />
            <Link
              href="/sandbox/history"
              className="flex items-center gap-2.5 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-violet-500/30 hover:bg-zinc-800/40"
            >
              <History className="h-4 w-4 text-violet-400" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-zinc-200">Query History</span>
                {historyCount > 0 && (
                  <p className="text-[11px] text-zinc-500">{historyCount} quer{historyCount === 1 ? 'y' : 'ies'} recorded</p>
                )}
              </div>
              <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                {historyCount}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        execute={execute}
        onCreated={refreshTables}
      />

      {showTriggersPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close trigger inspector"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowTriggersPanel(false)}
          />

          <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-zinc-900/95 to-zinc-950 p-4 shadow-2xl shadow-black/60 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-cyan-100">Trigger Inspector</h3>
                <p className="text-[11px] text-cyan-200/70">
                  {triggerRows.length} trigger{triggerRows.length === 1 ? '' : 's'} in {activeDatabase}
                  {triggerQueryMs !== null && ` · ${triggerQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadTriggers}
                  className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowTriggersPanel(false)}
                  className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close trigger inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {triggerQueryError ? (
              <SqlErrorAlert error={triggerQueryError} compact />
            ) : triggerRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-cyan-500/25 bg-zinc-950/50 px-4 py-6 text-center text-sm text-zinc-400">
                No triggers found in this database.
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {triggerRows.map((trigger) => (
                  <div
                    key={`${trigger.Trigger}-${trigger.Table}`}
                    className="rounded-xl border border-cyan-500/20 bg-zinc-950/60 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                        {trigger.Trigger}
                      </span>
                      <span className="text-[11px] text-zinc-400">on table</span>
                      <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] text-zinc-200">
                        {trigger.Table}
                      </span>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                      {trigger.Statement}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showProceduresPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close procedure inspector"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowProceduresPanel(false)}
          />

          <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-zinc-900/95 to-zinc-950 p-4 shadow-2xl shadow-black/60 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-fuchsia-100">Procedure Inspector</h3>
                <p className="text-[11px] text-fuchsia-200/70">
                  {procedureRows.length} procedure{procedureRows.length === 1 ? '' : 's'}
                  {procedureQueryMs !== null && ` · ${procedureQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadProcedures}
                  className="rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowProceduresPanel(false)}
                  className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close procedure inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {procedureQueryError ? (
              <SqlErrorAlert error={procedureQueryError} compact />
            ) : procedureRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-fuchsia-500/25 bg-zinc-950/50 px-4 py-6 text-center text-sm text-zinc-400">
                No procedures found.
              </div>
            ) : (
              <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
                <div className="overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 lg:col-span-1">
                  <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Procedures</div>
                  <div className="space-y-1">
                    {procedureRows.map((proc) => {
                      const qualifiedName = `${proc.Db}.${proc.Name}`;
                      const isSelected = selectedProcedureName === qualifiedName;
                      return (
                        <button
                          key={qualifiedName}
                          onClick={() => loadProcedureDefinition(proc)}
                          className={cn(
                            'w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-all',
                            isSelected
                              ? 'border-fuchsia-500/35 bg-fuchsia-500/15 text-fuchsia-100'
                              : 'border-zinc-800/80 bg-zinc-900/70 text-zinc-300 hover:border-fuchsia-500/25 hover:bg-fuchsia-500/10',
                          )}
                        >
                          <div className="truncate font-medium">{proc.Name}</div>
                          <div className="mt-0.5 text-[10px] text-zinc-500">{proc.Db}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 lg:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-zinc-400">
                      {selectedProcedureName ? `Definition: ${selectedProcedureName}` : 'Select a procedure to view definition'}
                    </div>
                  </div>
                  {selectedProcedureSql ? (
                    <pre className="max-h-[48vh] overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                      {selectedProcedureSql}
                    </pre>
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-500">
                      Pick a procedure from the left.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSecurityPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close security inspector"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSecurityPanel(false)}
          />

          <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-zinc-900/95 to-zinc-950 p-4 shadow-2xl shadow-black/60 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-amber-100">Security Inspector</h3>
                <p className="text-[11px] text-amber-200/70">
                  {users.length} user{users.length === 1 ? '' : 's'}
                  {grantsQueryMs !== null && ` · grants fetched in ${grantsQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <button
                onClick={() => setShowSecurityPanel(false)}
                className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close security inspector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
              <div className="overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 lg:col-span-1">
                <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Users</div>
                <div className="space-y-1">
                  {users.map((userName) => {
                    const normalizedUser = userName.toLowerCase();
                    const isSelected = selectedSecurityUser.toLowerCase() === normalizedUser;
                    const isActive = activeUser.toLowerCase() === normalizedUser;
                    return (
                      <button
                        key={userName}
                        onClick={() => {
                          setSelectedSecurityUser(userName);
                          loadGrantsForUser(userName);
                        }}
                        className={cn(
                          'w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-all',
                          isSelected
                            ? 'border-amber-500/35 bg-amber-500/15 text-amber-100'
                            : 'border-zinc-800/80 bg-zinc-900/70 text-zinc-300 hover:border-amber-500/25 hover:bg-amber-500/10',
                        )}
                      >
                        <div className="truncate font-medium">{userName}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">{isActive ? 'current session user' : 'available user'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 lg:col-span-2">
                <div className="mb-2 text-[11px] text-zinc-400">
                  {selectedSecurityUser ? `Grants for ${selectedSecurityUser}` : 'Select a user to inspect grants'}
                </div>

                {grantsQueryError ? (
                  <SqlErrorAlert error={grantsQueryError} compact />
                ) : grantsRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-500">
                    No grants to show.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grantsRows.map((grant, index) => (
                      <pre
                        key={`${grant}-${index}`}
                        className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-2 font-mono text-[11px] leading-relaxed text-zinc-300"
                      >
                        {grant}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
