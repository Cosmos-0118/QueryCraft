'use client';

import { useCallback, useMemo, useState } from 'react';
import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    type Edge,
    type Node,
    type NodeChange,
    type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { detectNormalForm } from '@/lib/engine/normalizer-engine';
import { useNormalizerStore } from '@/stores/normalizer-store';
import type { NormalForm, TableSchema } from '@/types/normalizer';
import { FKEdge } from './fk-edge';
import { TableNode } from './table-node';

const nodeTypes = {
    table: TableNode,
};

const edgeTypes = {
    fk: FKEdge,
};

interface Point {
    x: number;
    y: number;
}

interface NodeDimensions {
    width?: number;
    height?: number;
}

const DEFAULT_NODE_WIDTH = 320;
const DEFAULT_NODE_HEIGHT = 220;

function gridLayout(index: number): Point {
    const cols = 3;
    const column = index % cols;
    const row = Math.floor(index / cols);
    return {
        x: 120 + column * 360,
        y: 80 + row * 280,
    };
}

function getTablesForView(resultStepTables: TableSchema[] | null, fallbackTable: TableSchema | null): TableSchema[] {
    if (resultStepTables && resultStepTables.length > 0) return resultStepTables;
    if (fallbackTable) return [fallbackTable];
    return [];
}

export function NormalizerCanvas() {
    const {
        inputTable,
        result,
        currentStepIndex,
        selectedNodeId,
        showSampleData,
        showFDs,
        showAnomalies,
        selectNode,
    } = useNormalizerStore();

    const activeStep = result?.steps[currentStepIndex] ?? null;

    const activeTables = useMemo(
        () => getTablesForView(activeStep?.outputTables ?? null, inputTable),
        [activeStep?.outputTables, inputTable],
    );

    const currentNF: NormalForm = useMemo(() => {
        if (activeStep) return activeStep.toNF;
        if (result) return result.detectedNF;
        if (inputTable) return detectNormalForm(inputTable);
        return 'UNF';
    }, [activeStep, inputTable, result]);

    const highlightedColumnsByTable = useMemo(() => {
        const map = new Map<string, Set<string>>();
        const violations = activeStep?.violationsFound ?? [];

        for (const table of activeTables) {
            const columnSet = new Set(table.columns.map((column) => column.name));
            for (const violation of violations) {
                const touched = [...violation.determinant, ...violation.dependent].filter((column) => columnSet.has(column));
                if (touched.length === 0) continue;

                const existing = map.get(table.id) ?? new Set<string>();
                for (const column of touched) existing.add(column);
                map.set(table.id, existing);
            }
        }

        return map;
    }, [activeStep?.violationsFound, activeTables]);

    const [positions, setPositions] = useState<Record<string, Point>>({});
    const [dimensions, setDimensions] = useState<Record<string, NodeDimensions>>({});
    const stableNodeTypes = useMemo(() => nodeTypes, []);
    const stableEdgeTypes = useMemo(() => edgeTypes, []);

    const nodes = useMemo<Node[]>(() => {
        return activeTables.map((table, index) => {
            const measured = dimensions[table.id];
            const highlightedColumns = Array.from(highlightedColumnsByTable.get(table.id) ?? []);
            return {
                id: table.id,
                type: 'table',
                position: positions[table.id] ?? gridLayout(index),
                measured: {
                    width: measured?.width ?? DEFAULT_NODE_WIDTH,
                    height: measured?.height ?? DEFAULT_NODE_HEIGHT,
                },
                data: {
                    table,
                    normalForm: currentNF,
                    showSampleData,
                    hasViolation: showAnomalies && highlightedColumns.length > 0,
                    highlightedColumns,
                },
                selected: selectedNodeId === table.id,
                style: {
                    transition: 'transform 220ms ease',
                },
            };
        });
    }, [activeTables, currentNF, dimensions, highlightedColumnsByTable, positions, selectedNodeId, showAnomalies, showSampleData]);

    const edges = useMemo<Edge[]>(() => {
        if (!showFDs) return [];

        const tableByName = new Map(activeTables.map((table) => [table.name, table]));
        const list: Edge[] = [];

        for (const sourceTable of activeTables) {
            for (const foreignKey of sourceTable.foreignKeys) {
                const targetTable = tableByName.get(foreignKey.referencesTable);
                if (!targetTable) continue;

                const label = `${foreignKey.columns.join(', ')} -> ${foreignKey.referencesTable}.${foreignKey.referencesColumns.join(', ')}`;
                list.push({
                    id: `fk_${sourceTable.id}_${targetTable.id}_${foreignKey.columns.join('_')}`,
                    type: 'fk',
                    source: sourceTable.id,
                    target: targetTable.id,
                    animated: true,
                    data: {
                        label,
                        keyReference: true,
                    },
                });
            }
        }

        return list;
    }, [activeTables, showFDs]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes: NodeChange[]) => {
            for (const change of changes) {
                if (change.type === 'position' && change.position) {
                    setPositions((previous) => ({
                        ...previous,
                        [change.id]: {
                            x: change.position!.x,
                            y: change.position!.y,
                        },
                    }));
                }

                if (change.type === 'dimensions' && change.dimensions) {
                    const next = change.dimensions;
                    setDimensions((previous) => ({
                        ...previous,
                        [change.id]: {
                            width: next.width ?? previous[change.id]?.width ?? DEFAULT_NODE_WIDTH,
                            height: next.height ?? previous[change.id]?.height ?? DEFAULT_NODE_HEIGHT,
                        },
                    }));
                }

                if (change.type === 'select') {
                    if (change.selected) {
                        selectNode(change.id);
                    } else if (selectedNodeId === change.id) {
                        selectNode(null);
                    }
                }
            }
        },
        [selectNode, selectedNodeId],
    );

    if (!inputTable && (!result || result.steps.length === 0)) {
        return (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/45">
                <p className="text-sm text-muted-foreground">Load a preset or build a table to start normalizing.</p>
            </div>
        );
    }

    return (
        <div className="normalizer-canvas-wrapper h-full w-full overflow-hidden rounded-2xl border border-border bg-card/70">
            <style>{`
        .react-flow__node.selected > div,
        .react-flow__node:focus > div,
        .react-flow__node:focus-visible > div {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={stableNodeTypes}
                edgeTypes={stableEdgeTypes}
                onNodesChange={onNodesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={2.5}
                nodeDragThreshold={1}
                selectNodesOnDrag={false}
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color="color-mix(in oklab, var(--border) 80%, transparent)"
                    style={{ background: 'transparent' }}
                />
                <MiniMap
                    pannable
                    zoomable
                    nodeColor="color-mix(in oklab, var(--warning) 35%, var(--surface-strong))"
                    maskColor="color-mix(in oklab, var(--background) 70%, transparent)"
                    style={{
                        background: 'color-mix(in oklab, var(--card) 92%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--border) 85%, transparent)',
                    }}
                />
                <Controls
                    showInteractive={false}
                    className="!rounded-xl !border !border-border !bg-card/95 !shadow-lg !backdrop-blur-sm [&>button]:!border-border [&>button]:!bg-transparent [&>button]:!text-muted-foreground [&>button:hover]:!bg-muted/80"
                />
            </ReactFlow>
        </div>
    );
}
