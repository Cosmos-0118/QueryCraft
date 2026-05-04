'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import { useLoadingStore } from '@/stores/loading-store';
import { SqlEditor } from '@/components/sandbox/sql-editor';
import { SchemaBrowser } from '@/components/sandbox/schema-browser';

import { CreateTableModal } from '@/components/algebra/create-table-modal';
import { ResultPanel } from '@/components/visual/result-panel';
import { SqlErrorAlert } from '@/components/visual/sql-error-alert';
import type { QueryResult, StatementQueryResult } from '@/types/database';
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

type FloatingMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function getFloatingMenuPosition(anchor: HTMLElement): FloatingMenuPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportMargin = 12;
  const gap = 8;
  const width = 256;
  const desiredHeight = 320;

  const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
  const spaceAbove = rect.top - viewportMargin;
  const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
  const top = placeAbove
    ? Math.max(viewportMargin, rect.top - gap - Math.min(desiredHeight, Math.max(spaceAbove, 160)))
    : rect.bottom + gap;
  const maxHeight = Math.max(
    160,
    Math.min(desiredHeight, placeAbove ? rect.top - gap - viewportMargin : window.innerHeight - top - viewportMargin),
  );
  const left = Math.min(
    Math.max(viewportMargin, rect.right - width),
    window.innerWidth - width - viewportMargin,
  );

  return { top, left, width, maxHeight };
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
    seedDatasets,
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
  const [dbMenuPosition, setDbMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const [userMenuPosition, setUserMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const [editorFocusRequestKey, setEditorFocusRequestKey] = useState(0);
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
  const [showCursorsPanel, setShowCursorsPanel] = useState(false);
  const [cursorRows, setCursorRows] = useState<
    Array<{ Db: string; Procedure: string; Cursor: string; Query: string }>
  >([]);
  const [cursorQueryError, setCursorQueryError] = useState<string | null>(null);
  const [cursorQueryMs, setCursorQueryMs] = useState<number | null>(null);
  const [selectedCursorName, setSelectedCursorName] = useState<string | null>(null);
  const [selectedCursorSql, setSelectedCursorSql] = useState<string | null>(null);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);

  const [selectedSecurityUser, setSelectedSecurityUser] = useState<string>('');
  const [grantsRows, setGrantsRows] = useState<string[]>([]);
  const [grantsQueryError, setGrantsQueryError] = useState<string | null>(null);
  const [grantsQueryMs, setGrantsQueryMs] = useState<number | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const dbMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const dbMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const userMenuPanelRef = useRef<HTMLDivElement | null>(null);

  const seedDatasetNames = useMemo(
    () => new Set(seedDatasets.map((dataset) => dataset.name.toLowerCase())),
    [seedDatasets],
  );

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

  const updateDbMenuPosition = useCallback(() => {
    if (!dbMenuButtonRef.current) return;
    setDbMenuPosition(getFloatingMenuPosition(dbMenuButtonRef.current));
  }, []);

  const updateUserMenuPosition = useCallback(() => {
    if (!userMenuButtonRef.current) return;
    setUserMenuPosition(getFloatingMenuPosition(userMenuButtonRef.current));
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
    if (!showTriggersPanel && !showProceduresPanel && !showCursorsPanel && !showSecurityPanel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTriggersPanel(false);
        setShowProceduresPanel(false);
        setShowCursorsPanel(false);
        setShowSecurityPanel(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCursorsPanel, showProceduresPanel, showSecurityPanel, showTriggersPanel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        dbMenuRef.current &&
        !dbMenuRef.current.contains(target) &&
        !dbMenuPanelRef.current?.contains(target)
      ) {
        setShowDatabases(false);
      }

      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        !userMenuPanelRef.current?.contains(target)
      ) {
        setShowUsers(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDatabases) return;

    updateDbMenuPosition();
    const handleViewportChange = () => updateDbMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showDatabases, updateDbMenuPosition]);

  useEffect(() => {
    if (!showUsers) return;

    updateUserMenuPosition();
    const handleViewportChange = () => updateUserMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showUsers, updateUserMenuPosition]);

  useEffect(() => {
    const pendingDatabase = store.pendingDatabase;
    if (!pendingDatabase || !isReady) return;

    const switched = switchDatabase(pendingDatabase);
    if (!switched.error) {
      store.setPendingDatabase(null);
      return;
    }

    const fallback = switchDatabase('main');
    if (!fallback.error) {
      store.setPendingDatabase(null);
    }
  }, [isReady, store, switchDatabase]);

  // Restore the sandbox's preferred database when the engine becomes ready.
  // The engine is now cached (shared singleton) so it may currently be set to
  // whatever database another feature last used.
  useEffect(() => {
    if (!isReady) return;
    // pendingDatabase takes priority (set by history "Load in Editor")
    if (store.pendingDatabase) return;
    const preferred = store.lastDatabase;
    if (preferred && preferred !== activeDatabase) {
      const result = switchDatabase(preferred);
      if (result.error) {
        // Fall back silently — the database may have been dropped
        store.setLastDatabase(activeDatabase);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Keep the store's lastDatabase in sync whenever the engine's active database changes
  useEffect(() => {
    if (isReady && activeDatabase) {
      store.setLastDatabase(activeDatabase);
    }
  }, [isReady, activeDatabase, store]);

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

  const loadCursors = useCallback(() => {
    const cursorResult = execute('SHOW CURSORS;');
    if (cursorResult.error) {
      setCursorRows([]);
      setCursorQueryMs(null);
      setCursorQueryError(cursorResult.error);
      return;
    }

    const rows = cursorResult.rows.map((row) => ({
      Db: String(row.Db ?? ''),
      Procedure: String(row.Procedure ?? ''),
      Cursor: String(row.Cursor ?? ''),
      Query: String(row.Query ?? ''),
    }));

    setCursorRows(rows);
    setCursorQueryMs(cursorResult.executionTimeMs);
    setCursorQueryError(null);
  }, [execute]);

  const handleExecute = useCallback(() => {
    const q = store.query.trim();
    if (!q) return;
    const res = loadSQL(q);
    setResult(res);
    store.setResults(res);

    // For large scripts (>4 statements), create separate history entries per statement
    const stmts = res.statementResults;
    if (stmts && stmts.length > 4) {
      for (const entry of stmts) {
        store.addToHistory(
          entry.statement,
          !entry.error,
          {
            columns: entry.columns,
            rows: entry.rows,
            rowCount: entry.rowCount,
            executionTimeMs: entry.executionTimeMs,
            error: entry.error,
            errorDetails: entry.errorDetails,
          },
          activeDatabase,
        );
      }
    } else {
      store.addToHistory(q, !res.error, res, activeDatabase);
    }

    triggerEditorFeedback(res.error ? 'error' : 'success');
    if (!res.error) {
      store.setQuery('');
    }

    // Auto-refresh side panels so newly created objects appear immediately
    loadTriggers();
    loadProcedures();
    loadCursors();
  }, [activeDatabase, loadSQL, store, triggerEditorFeedback, loadTriggers, loadProcedures, loadCursors]);

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
    loadTriggers();
    loadProcedures();
    loadCursors();
  }, [importSql, loadSQL, store, loadTriggers, loadProcedures, loadCursors]);

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

  const loadCursorDefinition = useCallback(
    (cursor: { Procedure: string; Cursor: string }) => {
      const qualifiedName = `${cursor.Procedure}.${cursor.Cursor}`;
      const definitionResult = execute(`SHOW CREATE CURSOR ${qualifiedName};`);
      if (definitionResult.error) {
        setSelectedCursorName(qualifiedName);
        setSelectedCursorSql(`Error: ${definitionResult.error}`);
        return;
      }

      const row = definitionResult.rows[0] ?? {};
      const definition =
        (row['Create Cursor'] as string | undefined) ??
        (Object.entries(row).find(([key]) => key.toLowerCase().includes('create'))?.[1] as
          | string
          | undefined) ??
        '';

      setSelectedCursorName(qualifiedName);
      setSelectedCursorSql(String(definition));
    },
    [execute],
  );

  const toSqlUserSpec = useCallback((userDisplay: string): string => {
    const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''");

    const trimmed = userDisplay.trim();
    if (!trimmed) return "'admin'@'localhost'";

    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex > -1) {
      const username = trimmed.slice(0, atIndex).trim() || 'admin';
      const host = trimmed.slice(atIndex + 1).trim() || 'localhost';
      return `'${escapeSqlLiteral(username)}'@'${escapeSqlLiteral(host)}'`;
    }

    return `'${escapeSqlLiteral(trimmed)}'@'localhost'`;
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
      setShowCursorsPanel(false);
      setShowSecurityPanel(false);
      setTriggerRows([]);
      setTriggerQueryError(null);
      setTriggerQueryMs(null);
      setProcedureRows([]);
      setProcedureQueryError(null);
      setProcedureQueryMs(null);
      setSelectedProcedureName(null);
      setSelectedProcedureSql(null);
      setCursorRows([]);
      setCursorQueryError(null);
      setCursorQueryMs(null);
      setSelectedCursorName(null);
      setSelectedCursorSql(null);
      setSelectedSecurityUser('');
      setGrantsRows([]);
      setGrantsQueryError(null);
      setGrantsQueryMs(null);
    });
  }, [reset, runWithActionLoading, store]);

  const tableCount = tables.length;
  const historyCount = store.queryHistory.length;
  const statementResults: StatementQueryResult[] = result
    ? result.statementResults && result.statementResults.length > 0
      ? result.statementResults
      : [
        {
          statement: store.query,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs,
          error: result.error,
          errorDetails: result.errorDetails,
        },
      ]
    : [];
  const hasOutputSection = Boolean(result?.error || statementResults.length > 0);

  return (
    <>
      <div className="qc-sandbox-page flex min-h-full flex-col gap-3 rounded-2xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="qc-sandbox-icon-badge mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">SQL Sandbox</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--sandbox-tone-emerald)' }} />
                  {tableCount} table{tableCount !== 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground/70">&middot;</span>
                <span>{historyCount} queries run</span>
                <span className="text-muted-foreground/70">&middot;</span>
                <span className="text-muted-foreground">MySQL-compatible</span>
              </div>
            </div>
          </div>

          <div className="qc-sandbox-surface w-full rounded-2xl p-3 sm:w-auto">
            <div className="overflow-x-auto overflow-y-visible">
              <div className="flex min-w-max flex-wrap items-center gap-2 xl:min-w-0">
                {/* Databases dropdown */}
                <div className="relative" ref={dbMenuRef}>
                  <button
                    ref={dbMenuButtonRef}
                    onClick={() => {
                      setShowUsers(false);
                      updateDbMenuPosition();
                      setShowDatabases((v) => !v);
                    }}
                    disabled={!isReady}
                    className="qc-sandbox-btn qc-sandbox-btn-neutral inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium"
                  >
                    <Database className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-sky)]" />
                    Databases
                    <span className="qc-sandbox-chip-muted rounded-full px-2 py-0.5 text-[10px]">
                      {activeDatabase}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Users dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    ref={userMenuButtonRef}
                    onClick={() => {
                      setShowDatabases(false);
                      updateUserMenuPosition();
                      setShowUsers((v) => !v);
                    }}
                    disabled={!isReady}
                    className="qc-sandbox-btn qc-sandbox-btn-neutral inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium"
                  >
                    <UserRound className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-amber)]" />
                    Users
                    <span className="qc-sandbox-chip-muted rounded-full px-2 py-0.5 text-[10px]">
                      {activeUser}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                <div className="qc-sandbox-divider mx-0.5 h-5 w-px" />

                {/* Create Table */}
                <button
                  onClick={() => setCreateOpen(true)}
                  disabled={!isReady}
                  data-tone="emerald"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Table
                </button>

                {/* Import SQL */}
                <button
                  onClick={() => setShowImport(!showImport)}
                  disabled={!isReady}
                  data-tone="violet"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
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
                  data-tone="cyan"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <ListTree className="h-3.5 w-3.5" />
                  Triggers
                  {triggerRows.length > 0 && (
                    <span data-tone="cyan" className="qc-sandbox-dialog-badge rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
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
                  data-tone="fuchsia"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  Procedures
                  {procedureRows.length > 0 && (
                    <span data-tone="fuchsia" className="qc-sandbox-dialog-badge rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      {procedureRows.length}
                    </span>
                  )}
                </button>

                {/* Cursors */}
                <button
                  onClick={() => {
                    if (!showCursorsPanel) {
                      loadCursors();
                    }
                    setShowCursorsPanel((v) => !v);
                  }}
                  disabled={!isReady}
                  data-tone="sky"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Cursors
                  {cursorRows.length > 0 && (
                    <span data-tone="sky" className="qc-sandbox-dialog-badge rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      {cursorRows.length}
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
                  data-tone="amber"
                  className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Security
                </button>

                {/* Clear */}
                <button
                  onClick={handleClearInputOutput}
                  className="qc-sandbox-btn qc-sandbox-btn-danger inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  Clear
                </button>

                {/* Reset */}
                <button
                  onClick={handleResetWorkspace}
                  className="qc-sandbox-btn qc-sandbox-btn-danger inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Import SQL Panel */}
        {showImport && (
          <div className="qc-sandbox-panel rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Import SQL</h3>
              <p className="text-[11px] text-muted-foreground">Paste CREATE TABLE / INSERT statements from Table Generator</p>
            </div>
            <textarea
              value={importSql}
              onChange={(e) => {
                setImportSql(e.target.value);
                if (importErrorResult) setImportErrorResult(null);
              }}
              placeholder={'-- Paste your SQL here\nCREATE TABLE "students" (\n  "id" INTEGER PRIMARY KEY,\n  "name" TEXT\n);'}
              className="qc-sandbox-textarea w-full rounded-xl px-4 py-3 font-mono text-sm"
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
                data-tone="violet"
                className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
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
                className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Engine Status */}
        {!isReady && (
          <div className="qc-sandbox-inline-status flex items-center gap-3 rounded-xl px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--sandbox-tone-emerald)' }} />
            <span className="text-sm text-muted-foreground">Initializing SQL engine…</span>
          </div>
        )}

        {/* Available Tables */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  store.setQuery(`SELECT * FROM "${t.name}" LIMIT 20;`);
                  setEditorFocusRequestKey((key) => key + 1);
                }}
                title={`Query "${t.name}"`}
                className="qc-sandbox-table-pill group inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-xs transition-all"
              >
                <Table2 className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[color:var(--sandbox-tone-emerald)]" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {/* Editor */}
          <div className="flex flex-col gap-3 lg:col-span-3">
            <SqlEditor
              value={store.query}
              onChange={store.setQuery}
              onExecute={handleExecute}
              tables={tables}
              historyCommands={store.queryHistory.map((entry) => entry.query)}
              executionFeedback={editorFeedback}
              hasOutput={Boolean(result)}
              focusRequestKey={editorFocusRequestKey}
              className="shrink-0"
            />

            {/* Run bar */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={!isReady}
                className="qc-sandbox-run-btn inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200"
              >
                <Play className="h-4 w-4" />
                Run Query
              </button>
              {result && result.columns.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="qc-sandbox-secondary-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3">
            <SchemaBrowser tables={tables} />
            <Link
              href="/sandbox/history"
              className="qc-sandbox-history-link flex items-center gap-2.5 rounded-xl px-4 py-3 transition-colors"
            >
              <History className="h-4 w-4 text-[color:var(--sandbox-tone-violet)]" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground">
                  Query History
                </span>
                {historyCount > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {historyCount} quer{historyCount === 1 ? 'y' : 'ies'} recorded
                  </p>
                )}
              </div>
              <span data-tone="violet" className="qc-sandbox-dialog-badge rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                {historyCount}
              </span>
            </Link>
          </div>
        </div>

        {hasOutputSection && (
          <div className="qc-sandbox-surface-soft flex flex-col rounded-xl p-2 sm:p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/85">
                Query Output
              </span>
              {!result?.error && (
                <span className="text-[11px] text-muted-foreground/80">
                  {statementResults.length} statement{statementResults.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="space-y-3 pr-1">
              {/* Error */}
              {result?.error && (
                <SqlErrorAlert error={result.error} details={result.errorDetails} />
              )}

              {/* Per-statement output */}
              {!result?.error && statementResults.length > 0 &&
                statementResults.map((entry, index) => {
                  const statementLabel = `Statement ${index + 1}`;

                  if (entry.columns.length > 0) {
                    return (
                      <div key={`${statementLabel}-${index}`} className="space-y-1.5">
                        <p className="px-1 text-[11px] font-medium text-muted-foreground">
                          {statementLabel}
                        </p>
                        <ResultPanel
                          columns={entry.columns}
                          rows={entry.rows}
                          rowCount={entry.rowCount}
                          executionTimeMs={entry.executionTimeMs}
                          compact
                          scrollMode="page"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${statementLabel}-${index}`}
                      className="qc-sandbox-success-banner flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        {statementLabel}: query executed successfully.{' '}
                        {entry.rowCount > 0 ? `${entry.rowCount} row(s) affected.` : 'No rows returned.'}{' '}
                        ({entry.executionTimeMs.toFixed(1)}ms)
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
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
            className="qc-sandbox-overlay absolute inset-0"
            onClick={() => setShowTriggersPanel(false)}
          />

          <div data-tone="cyan" className="qc-sandbox-dialog relative z-10 w-full max-w-4xl rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Trigger Inspector</h3>
                <p className="text-[11px] text-muted-foreground">
                  {triggerRows.length} trigger{triggerRows.length === 1 ? '' : 's'} in {activeDatabase}
                  {triggerQueryMs !== null && ` · ${triggerQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadTriggers}
                  data-tone="cyan"
                  className="qc-sandbox-btn qc-sandbox-btn-tone rounded-lg px-2.5 py-1 text-[11px] font-medium"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowTriggersPanel(false)}
                  className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg p-1.5 text-muted-foreground"
                  aria-label="Close trigger inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {triggerQueryError ? (
              <SqlErrorAlert error={triggerQueryError} compact />
            ) : triggerRows.length === 0 ? (
              <div className="qc-sandbox-empty-state rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
                No triggers found in this database.
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {triggerRows.map((trigger) => (
                  <div
                    key={`${trigger.Trigger}-${trigger.Table}`}
                    className="qc-sandbox-surface-soft rounded-xl p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span data-tone="cyan" className="qc-sandbox-dialog-badge rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {trigger.Trigger}
                      </span>
                      <span className="text-[11px] text-muted-foreground">on table</span>
                      <span className="qc-sandbox-chip-muted rounded-full px-2 py-0.5 font-mono text-[10px]">
                        {trigger.Table}
                      </span>
                    </div>
                    <pre className="qc-sandbox-code-block overflow-x-auto rounded-lg p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                      {trigger.Statement}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showDatabases && dbMenuPosition && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={dbMenuPanelRef}
            className="qc-sandbox-dropdown fixed z-[120] overflow-hidden rounded-xl p-2"
            style={{
              top: dbMenuPosition.top,
              left: dbMenuPosition.left,
              width: dbMenuPosition.width,
              maxHeight: dbMenuPosition.maxHeight,
            }}
          >
            <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Available databases
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: dbMenuPosition.maxHeight - 34 }}>
              {databases.map((dbName) => {
                const normalizedDbName = dbName.toLowerCase();
                const isSystemDb = normalizedDbName === 'main' || seedDatasetNames.has(normalizedDbName);
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
                    data-tone={isSystemDb ? 'sky' : 'violet'}
                    data-active={isActiveDb ? 'true' : 'false'}
                    className="qc-sandbox-dropdown-item flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                  >
                    <span className="truncate font-medium">{dbName}</span>
                    <span data-tone={isSystemDb ? 'sky' : 'violet'} className="qc-sandbox-dialog-badge rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      {isSystemDb ? 'system' : 'user'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}

      {showUsers && userMenuPosition && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={userMenuPanelRef}
            className="qc-sandbox-dropdown fixed z-[120] overflow-hidden rounded-xl p-2"
            style={{
              top: userMenuPosition.top,
              left: userMenuPosition.left,
              width: userMenuPosition.width,
              maxHeight: userMenuPosition.maxHeight,
            }}
          >
            <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Available users
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: userMenuPosition.maxHeight - 34 }}>
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
                    data-tone={isAdmin ? 'amber' : 'emerald'}
                    data-active={isActive ? 'true' : 'false'}
                    className="qc-sandbox-dropdown-item flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                  >
                    <span className="truncate font-medium">{userName}</span>
                    <span data-tone={isAdmin ? 'amber' : 'emerald'} className="qc-sandbox-dialog-badge rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      {isAdmin ? 'admin' : 'user'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}

      {showProceduresPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close procedure inspector"
            className="qc-sandbox-overlay absolute inset-0"
            onClick={() => setShowProceduresPanel(false)}
          />

          <div data-tone="fuchsia" className="qc-sandbox-dialog relative z-10 w-full max-w-5xl rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Procedure Inspector</h3>
                <p className="text-[11px] text-muted-foreground">
                  {procedureRows.length} procedure{procedureRows.length === 1 ? '' : 's'}
                  {procedureQueryMs !== null && ` · ${procedureQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadProcedures}
                  data-tone="fuchsia"
                  className="qc-sandbox-btn qc-sandbox-btn-tone rounded-lg px-2.5 py-1 text-[11px] font-medium"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowProceduresPanel(false)}
                  className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg p-1.5 text-muted-foreground"
                  aria-label="Close procedure inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {procedureQueryError ? (
              <SqlErrorAlert error={procedureQueryError} compact />
            ) : procedureRows.length === 0 ? (
              <div className="qc-sandbox-empty-state rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
                No procedures found.
              </div>
            ) : (
              <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
                <div className="qc-sandbox-list overflow-y-auto rounded-xl p-2 lg:col-span-1">
                  <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Procedures</div>
                  <div className="space-y-1">
                    {procedureRows.map((proc) => {
                      const qualifiedName = `${proc.Db}.${proc.Name}`;
                      const isSelected = selectedProcedureName === qualifiedName;
                      return (
                        <button
                          key={qualifiedName}
                          onClick={() => loadProcedureDefinition(proc)}
                          data-tone="fuchsia"
                          data-active={isSelected ? 'true' : 'false'}
                          className="qc-sandbox-list-item w-full rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                        >
                          <div className="truncate font-medium">{proc.Name}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{proc.Db}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="qc-sandbox-surface-soft rounded-xl p-3 lg:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      {selectedProcedureName ? `Definition: ${selectedProcedureName}` : 'Select a procedure to view definition'}
                    </div>
                  </div>
                  {selectedProcedureSql ? (
                    <pre className="qc-sandbox-code-block max-h-[48vh] overflow-auto rounded-lg p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                      {selectedProcedureSql}
                    </pre>
                  ) : (
                    <div className="qc-sandbox-empty-state rounded-lg px-4 py-6 text-center text-sm text-muted-foreground">
                      Pick a procedure from the left.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCursorsPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close cursor inspector"
            className="qc-sandbox-overlay absolute inset-0"
            onClick={() => setShowCursorsPanel(false)}
          />

          <div data-tone="sky" className="qc-sandbox-dialog relative z-10 w-full max-w-5xl rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Cursor Inspector</h3>
                <p className="text-[11px] text-muted-foreground">
                  {cursorRows.length} cursor{cursorRows.length === 1 ? '' : 's'}
                  {cursorQueryMs !== null && ` · ${cursorQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadCursors}
                  data-tone="sky"
                  className="qc-sandbox-btn qc-sandbox-btn-tone rounded-lg px-2.5 py-1 text-[11px] font-medium"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowCursorsPanel(false)}
                  className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg p-1.5 text-muted-foreground"
                  aria-label="Close cursor inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {cursorQueryError ? (
              <SqlErrorAlert error={cursorQueryError} compact />
            ) : cursorRows.length === 0 ? (
              <div className="qc-sandbox-empty-state rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
                No cursors found in stored procedures.
              </div>
            ) : (
              <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
                <div className="qc-sandbox-list overflow-y-auto rounded-xl p-2 lg:col-span-1">
                  <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Cursors</div>
                  <div className="space-y-1">
                    {cursorRows.map((cursor) => {
                      const qualifiedName = `${cursor.Procedure}.${cursor.Cursor}`;
                      const isSelected = selectedCursorName === qualifiedName;
                      return (
                        <button
                          key={`${cursor.Db}.${qualifiedName}`}
                          onClick={() => loadCursorDefinition(cursor)}
                          data-tone="sky"
                          data-active={isSelected ? 'true' : 'false'}
                          className="qc-sandbox-list-item w-full rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                        >
                          <div className="truncate font-medium">{cursor.Cursor}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{cursor.Procedure}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="qc-sandbox-surface-soft rounded-xl p-3 lg:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      {selectedCursorName ? `Definition: ${selectedCursorName}` : 'Select a cursor to view declaration'}
                    </div>
                  </div>
                  {selectedCursorSql ? (
                    <div className="space-y-3">
                      <pre className="qc-sandbox-code-block max-h-[30vh] overflow-auto rounded-lg p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                        {selectedCursorSql}
                      </pre>
                      {cursorRows.find((cursor) => `${cursor.Procedure}.${cursor.Cursor}` === selectedCursorName)?.Query && (
                        <div data-tone="sky" className="qc-sandbox-list-item rounded-lg p-3">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resolved query</div>
                          <pre className="overflow-auto font-mono text-[11px] leading-relaxed text-foreground/90">
                            {cursorRows.find((cursor) => `${cursor.Procedure}.${cursor.Cursor}` === selectedCursorName)?.Query}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="qc-sandbox-empty-state rounded-lg px-4 py-6 text-center text-sm text-muted-foreground">
                      Pick a cursor from the left.
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
            className="qc-sandbox-overlay absolute inset-0"
            onClick={() => setShowSecurityPanel(false)}
          />

          <div data-tone="amber" className="qc-sandbox-dialog relative z-10 w-full max-w-5xl rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Security Inspector</h3>
                <p className="text-[11px] text-muted-foreground">
                  {users.length} user{users.length === 1 ? '' : 's'}
                  {grantsQueryMs !== null && ` · grants fetched in ${grantsQueryMs.toFixed(1)}ms`}
                </p>
              </div>
              <button
                onClick={() => setShowSecurityPanel(false)}
                className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg p-1.5 text-muted-foreground"
                aria-label="Close security inspector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
              <div className="qc-sandbox-list overflow-y-auto rounded-xl p-2 lg:col-span-1">
                <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Users</div>
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
                        data-tone="amber"
                        data-active={isSelected ? 'true' : 'false'}
                        className="qc-sandbox-list-item w-full rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                      >
                        <div className="truncate font-medium">{userName}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{isActive ? 'current session user' : 'available user'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="qc-sandbox-surface-soft overflow-y-auto rounded-xl p-3 lg:col-span-2">
                <div className="mb-2 text-[11px] text-muted-foreground">
                  {selectedSecurityUser ? `Grants for ${selectedSecurityUser}` : 'Select a user to inspect grants'}
                </div>

                {grantsQueryError ? (
                  <SqlErrorAlert error={grantsQueryError} compact />
                ) : grantsRows.length === 0 ? (
                  <div className="qc-sandbox-empty-state rounded-lg px-4 py-6 text-center text-sm text-muted-foreground">
                    No grants to show.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grantsRows.map((grant, index) => (
                      <pre
                        key={`${grant}-${index}`}
                        className="qc-sandbox-code-block overflow-x-auto rounded-lg p-2 font-mono text-[11px] leading-relaxed text-foreground/90"
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
