'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useERStore } from '@/stores/er-store';
import { EntityNode } from './entity-node';
import { AttributeNode } from './attribute-node';
import { RelationshipNode } from './relationship-node';

const nodeTypes = {
  entity: EntityNode,
  attribute: AttributeNode,
  relationship: RelationshipNode,
};

export function ERCanvas() {
  const store = useERStore();

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
    // Attribute → Entity
    for (const attr of store.attributes) {
      e.push({
        id: `${attr.id}-${attr.entityId}`,
        source: attr.entityId,
        target: attr.id,
        style: { stroke: 'var(--border)', strokeWidth: 1.5 },
      });
    }
    // Relationship → Entities
    for (const rel of store.relationships) {
      const [e1, e2] = rel.entities;
      const labelParts = rel.cardinality.split(':');
      e.push({
        id: `${rel.id}-${e1}`,
        source: e1,
        target: rel.id,
        label: labelParts[0],
        style: { stroke: 'var(--border)', strokeWidth: 1.5 },
      });
      e.push({
        id: `${rel.id}-${e2}`,
        source: rel.id,
        target: e2,
        label: labelParts[1],
        style: { stroke: 'var(--border)', strokeWidth: 1.5 },
      });
    }
    return e;
  }, [store.attributes, store.relationships]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle position changes via store
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
    <div className="h-[500px] rounded-lg border border-border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        onNodesDelete={(deleted) => deleted.forEach((n) => store.removeNode(n.id))}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
