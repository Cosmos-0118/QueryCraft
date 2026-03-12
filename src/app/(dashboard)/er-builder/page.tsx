'use client';

import { useCallback, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useERStore } from '@/stores/er-store';
import { ERCanvas } from '@/components/er-diagram/er-canvas';
import { ERToolbar } from '@/components/er-diagram/er-toolbar';
import { PropertiesPanel } from '@/components/er-diagram/properties-panel';
import { erToRelational, schemasToSQL } from '@/lib/engine/er-to-relational';
import { TableViewer } from '@/components/visual/table-viewer';
import type { ERDiagram } from '@/types/er-diagram';
import {
  GraduationCap,
  Landmark,
  ArrowRightLeft,
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
    /* Customer attrs — fanned upper-left */
    { id: 'a1', name: 'cust_id', kind: 'key', entityId: 'e1', position: { x: -70, y: 50 } },
    { id: 'a2', name: 'name', kind: 'regular', entityId: 'e1', position: { x: -100, y: 150 } },
    { id: 'a3', name: 'phone', kind: 'multivalued', entityId: 'e1', position: { x: -70, y: 250 } },
    /* Account attrs — fanned upper-right */
    { id: 'a4', name: 'acct_no', kind: 'key', entityId: 'e2', position: { x: 980, y: 70 } },
    { id: 'a5', name: 'balance', kind: 'regular', entityId: 'e2', position: { x: 990, y: 180 } },
    /* Branch attrs — fanned downward */
    { id: 'a6', name: 'branch_id', kind: 'key', entityId: 'e3', position: { x: 260, y: 560 } },
    { id: 'a7', name: 'branch_name', kind: 'regular', entityId: 'e3', position: { x: 420, y: 620 } },
    { id: 'a8', name: 'city', kind: 'regular', entityId: 'e3', position: { x: 580, y: 560 } },
  ],
  relationships: [
    { id: 'r1', name: 'has', cardinality: '1:N', entities: ['e1', 'e2'], position: { x: 430, y: 110 } },
    { id: 'r2', name: 'maintained_at', cardinality: '1:N', entities: ['e3', 'e2'], position: { x: 640, y: 330 } },
  ],
};

/* ── Page Component ───────────────────────────────────────── */

export default function ERBuilderPage() {
  const store = useERStore();
  const [showSchema, setShowSchema] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleConvert = useCallback(() => {
    const diagram = store.getDiagram();
    const tables = erToRelational(diagram);
    store.setGeneratedTables(tables);
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

  return (
    <ReactFlowProvider>
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
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
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm">
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
                <div className="grid gap-4 md:grid-cols-2">
                  {store.generatedTables.map((table) => (
                    <div key={table.name} className="overflow-hidden rounded-xl border border-zinc-800/60">
                      <div
                        className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5"
                        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 100%)' }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                        <h3 className="text-xs font-bold text-zinc-300">{table.name}</h3>
                      </div>
                      <TableViewer
                        columns={['Column', 'Type', 'PK', 'FK']}
                        rows={table.columns.map((c) => ({
                          Column: c.name,
                          Type: c.type,
                          PK: c.primaryKey ? 'Yes' : '',
                          FK: c.foreignKey ? `→ ${c.foreignKey.table}.${c.foreignKey.column}` : '',
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
