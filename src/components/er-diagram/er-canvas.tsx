'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
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
        data: { label: e.name, isWeak: e.isWeak },
        selected: store.selectedId === e.id,
      });
    }
    for (const a of store.attributes) {
      n.push({
        id: a.id,
        type: 'attribute',
        position: a.position,
        data: { label: a.name, kind: a.kind },
        selected: store.selectedId === a.id,
      });
    }
    for (const r of store.relationships) {
      n.push({
        id: r.id,
        type: 'relationship',
        position: r.position,
        data: { label: r.name, cardinality: r.cardinality },
        selected: store.selectedId === r.id,
      });
    }
    return n;
  }, [store.entities, store.attributes, store.relationships, store.selectedId]);

  const edges = useMemo<Edge[]>(() => {
    const e: Edge[] = [];
    // Attribute → Entity — subtle floating lines (shortest path)
    for (const attr of store.attributes) {
      e.push({
        id: `attr-${attr.id}-${attr.entityId}`,
        source: attr.entityId,
        target: attr.id,
        type: 'floating',
        style: { stroke: 'rgba(113,113,122,0.3)', strokeWidth: 1 },
        animated: false,
      });
    }
    // Relationship → Entities — prominent floating lines with labels
    for (const rel of store.relationships) {
      const [e1, e2] = rel.entities;
      const labelParts = rel.cardinality.split(':');
      e.push({
        id: `rel-${rel.id}-${e1}`,
        source: e1,
        target: rel.id,
        type: 'floating',
        label: labelParts[0],
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontWeight: 700, fontSize: 10, fill: '#d4d4d8', fontFamily: 'system-ui' },
        labelBgStyle: { fill: '#1c1c1f', stroke: 'rgba(63,63,70,0.4)', strokeWidth: 1 },
        style: { stroke: 'rgba(139,92,246,0.4)', strokeWidth: 1.5 },
      });
      e.push({
        id: `rel-${rel.id}-${e2}`,
        source: rel.id,
        target: e2,
        type: 'floating',
        label: labelParts[1],
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontWeight: 700, fontSize: 10, fill: '#d4d4d8', fontFamily: 'system-ui' },
        labelBgStyle: { fill: '#1c1c1f', stroke: 'rgba(63,63,70,0.4)', strokeWidth: 1 },
        style: { stroke: 'rgba(139,92,246,0.4)', strokeWidth: 1.5 },
      });
    }
    return e;
  }, [store.attributes, store.relationships]);

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
      className="er-canvas-wrapper h-full w-full overflow-hidden rounded-xl border border-zinc-800/80"
      style={{ background: 'linear-gradient(180deg, #0c0c0f 0%, #111114 100%)' }}
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
          color="rgba(113,113,122,0.12)"
          style={{ background: 'transparent' }}
        />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border !border-zinc-800/60 !bg-zinc-900/90 !shadow-xl !shadow-black/20 !backdrop-blur-sm [&>button]:!border-zinc-800/40 [&>button]:!bg-transparent [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-800/60"
        />
      </ReactFlow>
    </div>
  );
}
