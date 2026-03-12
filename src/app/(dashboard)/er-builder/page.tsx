'use client';

import { useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useERStore } from '@/stores/er-store';
import { ERCanvas } from '@/components/er-diagram/er-canvas';
import { ERToolbar } from '@/components/er-diagram/er-toolbar';
import { erToRelational, schemasToSQL } from '@/lib/engine/er-to-relational';
import { TableViewer } from '@/components/visual/table-viewer';
import type { ERDiagram } from '@/types/er-diagram';

const UNIVERSITY_DIAGRAM: ERDiagram = {
  entities: [
    { id: 'e1', name: 'Student', isWeak: false, position: { x: 50, y: 100 } },
    { id: 'e2', name: 'Department', isWeak: false, position: { x: 450, y: 100 } },
    { id: 'e3', name: 'Course', isWeak: false, position: { x: 250, y: 300 } },
  ],
  attributes: [
    { id: 'a1', name: 'student_id', kind: 'key', entityId: 'e1', position: { x: -100, y: 30 } },
    { id: 'a2', name: 'name', kind: 'regular', entityId: 'e1', position: { x: -100, y: 100 } },
    { id: 'a3', name: 'gpa', kind: 'regular', entityId: 'e1', position: { x: -100, y: 170 } },
    { id: 'a4', name: 'dept_id', kind: 'key', entityId: 'e2', position: { x: 600, y: 30 } },
    { id: 'a5', name: 'dept_name', kind: 'regular', entityId: 'e2', position: { x: 600, y: 100 } },
    { id: 'a6', name: 'course_id', kind: 'key', entityId: 'e3', position: { x: 100, y: 380 } },
    { id: 'a7', name: 'title', kind: 'regular', entityId: 'e3', position: { x: 250, y: 420 } },
    { id: 'a8', name: 'credits', kind: 'regular', entityId: 'e3', position: { x: 400, y: 380 } },
  ],
  relationships: [
    { id: 'r1', name: 'belongs_to', cardinality: '1:N', entities: ['e2', 'e1'], position: { x: 250, y: 100 } },
    { id: 'r2', name: 'enrolls', cardinality: 'M:N', entities: ['e1', 'e3'], position: { x: 100, y: 230 } },
    { id: 'r3', name: 'offers', cardinality: '1:N', entities: ['e2', 'e3'], position: { x: 400, y: 230 } },
  ],
};

const BANKING_DIAGRAM: ERDiagram = {
  entities: [
    { id: 'e1', name: 'Customer', isWeak: false, position: { x: 50, y: 100 } },
    { id: 'e2', name: 'Account', isWeak: false, position: { x: 400, y: 100 } },
    { id: 'e3', name: 'Branch', isWeak: false, position: { x: 250, y: 300 } },
  ],
  attributes: [
    { id: 'a1', name: 'cust_id', kind: 'key', entityId: 'e1', position: { x: -100, y: 40 } },
    { id: 'a2', name: 'name', kind: 'regular', entityId: 'e1', position: { x: -100, y: 120 } },
    { id: 'a3', name: 'phone', kind: 'multivalued', entityId: 'e1', position: { x: -100, y: 190 } },
    { id: 'a4', name: 'acct_no', kind: 'key', entityId: 'e2', position: { x: 550, y: 40 } },
    { id: 'a5', name: 'balance', kind: 'regular', entityId: 'e2', position: { x: 550, y: 120 } },
    { id: 'a6', name: 'branch_id', kind: 'key', entityId: 'e3', position: { x: 100, y: 370 } },
    { id: 'a7', name: 'branch_name', kind: 'regular', entityId: 'e3', position: { x: 300, y: 400 } },
    { id: 'a8', name: 'city', kind: 'regular', entityId: 'e3', position: { x: 400, y: 370 } },
  ],
  relationships: [
    { id: 'r1', name: 'has', cardinality: '1:N', entities: ['e1', 'e2'], position: { x: 230, y: 100 } },
    { id: 'r2', name: 'maintained_at', cardinality: '1:N', entities: ['e3', 'e2'], position: { x: 370, y: 230 } },
  ],
};

export default function ERBuilderPage() {
  const store = useERStore();

  const handleConvert = useCallback(() => {
    const diagram = store.getDiagram();
    const tables = erToRelational(diagram);
    store.setGeneratedTables(tables);
  }, [store]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ER Diagram Builder</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build ER diagrams visually and auto-generate relational tables.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => store.loadDiagram(UNIVERSITY_DIAGRAM)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Load University
            </button>
            <button
              onClick={() => store.loadDiagram(BANKING_DIAGRAM)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Load Banking
            </button>
            <button
              onClick={handleConvert}
              disabled={store.entities.length === 0}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Convert to Tables
            </button>
          </div>
        </div>

        <ERToolbar />
        <ERCanvas />

        {store.generatedTables.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Generated Relational Schema</h2>
            <pre className="overflow-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm">
              {schemasToSQL(store.generatedTables)}
            </pre>
            {store.generatedTables.map((table) => (
              <div key={table.name}>
                <h3 className="mb-1 font-semibold">{table.name}</h3>
                <TableViewer
                  columns={['Column', 'Type', 'PK', 'FK']}
                  rows={table.columns.map((c) => ({
                    Column: c.name,
                    Type: c.type,
                    PK: c.primaryKey ? '✓' : '',
                    FK: c.foreignKey ? `→ ${c.foreignKey.table}.${c.foreignKey.column}` : '',
                  }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
