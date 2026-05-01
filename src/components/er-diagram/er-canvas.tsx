'use client';

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  type OnNodesChange,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useERStore } from '@/stores/er-store';
import { EntityNode } from './entity-node';
import { AttributeNode } from './attribute-node';
import { RelationshipNode } from './relationship-node';
import { FloatingEdge } from './floating-edge';

const nodeTypes = {
  entity: EntityNode,
  attribute: AttributeNode,
  relationship: RelationshipNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

export function ERCanvas() {
  const store = useERStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Record<string, { width?: number; height?: number }>>({});

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  const nodes = useMemo<Node[]>(() => {
    const n: Node[] = [];
    for (const e of store.entities) {
      n.push({
        id: e.id,
        type: 'entity',
        position: e.position,
        measured: dimensions[e.id],
        data: { label: e.name, isWeak: e.isWeak },
        selected: store.selectedId === e.id,
      });
    }
    for (const a of store.attributes) {
      n.push({
        id: a.id,
        type: 'attribute',
        position: a.position,
        measured: dimensions[a.id],
        data: { label: a.name, kind: a.kind },
        selected: store.selectedId === a.id,
      });
    }
    for (const r of store.relationships) {
      n.push({
        id: r.id,
        type: 'relationship',
        position: r.position,
        measured: dimensions[r.id],
        data: { label: r.name, cardinality: r.cardinality },
        selected: store.selectedId === r.id,
      });
    }
    return n;
  }, [store.entities, store.attributes, store.relationships, store.selectedId, dimensions]);

  // Read CSS custom properties once so edges use the active theme colours.
  // We memoise on both data changes AND the resolved theme so re-theming
  // triggers a re-build of edge objects.
  const resolvedTheme =
    typeof document !== 'undefined'
      ? (document.documentElement.dataset.colorTheme ?? 'dark')
      : 'dark';

  const edges = useMemo<Edge[]>(() => {
    const root =
      typeof document !== 'undefined' ? document.documentElement : null;
    const getVar = (v: string, fallback: string) =>
      root ? getComputedStyle(root).getPropertyValue(v).trim() || fallback : fallback;

    const borderColor = getVar('--border', '#263247');
    const primaryColor = getVar('--primary', '#7dd3fc');
    const cardColor = getVar('--card', '#0d1322');
    const fgColor = getVar('--foreground', '#e7edf8');

    const e: Edge[] = [];
    // Attribute → Entity — subtle floating lines
    for (const attr of store.attributes) {
      e.push({
        id: `attr-${attr.id}-${attr.entityId}`,
        source: attr.entityId,
        target: attr.id,
        type: 'floating',
        style: { stroke: borderColor, strokeWidth: 1, opacity: 0.7 },
        animated: false,
      });
    }
    // Relationship → Entities — prominent floating lines with labels
    for (const rel of store.relationships) {
      const [e1, e2] = rel.entities;
      const labelParts = rel.cardinality.split(':');
      const relEdge = {
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontWeight: 700, fontSize: 10, fill: fgColor, fontFamily: 'system-ui' },
        labelBgStyle: { fill: cardColor, stroke: borderColor, strokeWidth: 1 },
        style: { stroke: primaryColor, strokeWidth: 1.5, opacity: 0.55 },
      };
      e.push({ id: `rel-${rel.id}-${e1}`, source: e1, target: rel.id, type: 'floating', label: labelParts[0], ...relEdge });
      e.push({ id: `rel-${rel.id}-${e2}`, source: rel.id, target: e2, type: 'floating', label: labelParts[1], ...relEdge });
    }
    return e;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.attributes, store.relationships, resolvedTheme]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const id = change.id;
          if (store.entities.some((e) => e.id === id)) {
            store.updateEntityPos(id, change.position);
          } else if (store.attributes.some((a) => a.id === id)) {
            store.updateAttributePos(id, change.position);
          } else if (store.relationships.some((r) => r.id === id)) {
            store.updateRelationshipPos(id, change.position);
          }
        }
        if (change.type === 'dimensions' && change.dimensions) {
          const dim = change.dimensions;
          setDimensions((prev) => ({ ...prev, [change.id]: dim }));
        }
        if (change.type === 'select') {
          if (change.selected) store.setSelectedId(change.id);
          else if (store.selectedId === change.id) store.setSelectedId(null);
        }
      }
    },
    [store],
  );

  return (
    <div
      ref={wrapperRef}
      className="er-canvas-wrapper h-full w-full overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Hide React Flow's default node selection outlines / bounding boxes */}
      <style>{`
        .react-flow__node.selected > div,
        .react-flow__node:focus > div,
        .react-flow__node:focus-visible > div {
          outline: none !important;
          box-shadow: none !important;
        }
        .react-flow__node {
          outline: none !important;
        }
        .react-flow__node.selected {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode={['Backspace', 'Delete']}
        onNodesDelete={(deleted) => deleted.forEach((n) => store.removeNode(n.id))}
        minZoom={0.15}
        maxZoom={2.5}
        nodeDragThreshold={1}
        selectNodesOnDrag={false}
        nodesFocusable
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border)"
          style={{ background: 'transparent' }}
        />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border !border-border !bg-card/95 !shadow-lg !backdrop-blur-sm [&>button]:!border-border [&>button]:!bg-transparent [&>button]:!text-muted-foreground [&>button:hover]:!bg-muted/80"
        />
      </ReactFlow>
    </div>
  );
}
