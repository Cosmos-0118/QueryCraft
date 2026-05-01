'use client';

import { useCallback, useState, type ReactNode } from 'react';
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    type Connection,
    type Edge,
    type EdgeChange,
    type Node,
    type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    CheckCircle2,
    Database,
    Plus,
    ShieldCheck,
    Trash2,
    XCircle,
} from 'lucide-react';
import { detectNormalForm } from '@/lib/engine/normalizer-engine';
import type { Column, NormalForm, TableSchema } from '@/types/normalizer';

type CanvasStage = 'UNF' | '1NF' | '2NF' | '3NF' | '4NF' | '5NF';

interface CanvasNodeData extends Record<string, unknown> {
    table: TableSchema;
    label: ReactNode;
}

interface StageCanvas {
    nodes: Node<CanvasNodeData>[];
    edges: Edge[];
}

interface TableVerification {
    tableName: string;
    detected: NormalForm;
    ok: boolean;
}

interface StageVerification {
    stage: CanvasStage;
    pass: boolean;
    checks: TableVerification[];
}

interface VerificationSummary {
    allPass: boolean;
    stages: StageVerification[];
}

const STAGES: CanvasStage[] = ['UNF', '1NF', '2NF', '3NF', '4NF', '5NF'];
const ENGINE_ORDER: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];

const STAGE_MIN_INDEX: Record<CanvasStage, number> = {
    UNF: 0,
    '1NF': 1,
    '2NF': 2,
    '3NF': 3,
    '4NF': 5,
    '5NF': 6,
};

function createEmptyCanvases(): Record<CanvasStage, StageCanvas> {
    return {
        UNF: { nodes: [], edges: [] },
        '1NF': { nodes: [], edges: [] },
        '2NF': { nodes: [], edges: [] },
        '3NF': { nodes: [], edges: [] },
        '4NF': { nodes: [], edges: [] },
        '5NF': { nodes: [], edges: [] },
    };
}

function uid(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function parseList(input: string): string[] {
    return input
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function parseSampleRows(input: string, width: number): string[][] | undefined {
    const lines = input
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) return undefined;

    return lines.map((line) => {
        const values = line.split(',').map((value) => value.trim());
        return Array.from({ length: width }, (_, index) => values[index] ?? '');
    });
}

function renderTableLabel(table: TableSchema): ReactNode {
    return (
        <div className="min-w-[220px] max-w-[260px] rounded-xl border border-amber-500/25 bg-card/95 p-2 text-left shadow-md">
            <div className="mb-1.5 flex items-center justify-between border-b border-border/80 pb-1.5">
                <span className="truncate text-xs font-bold text-foreground">{table.name}</span>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    {table.primaryKey.length} PK
                </span>
            </div>
            <div className="space-y-1">
                {table.columns.map((column) => (
                    <div key={`${table.id}_${column.name}`} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        <span className={table.primaryKey.includes(column.name) ? 'font-semibold text-amber-300' : ''}>
                            {column.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function stageSatisfied(stage: CanvasStage, detected: NormalForm): boolean {
    if (stage === 'UNF') return detected === 'UNF';
    return ENGINE_ORDER.indexOf(detected) >= STAGE_MIN_INDEX[stage];
}

function isCanvasNodeData(data: unknown): data is CanvasNodeData {
    if (!data || typeof data !== 'object') return false;
    const value = data as Record<string, unknown>;
    if (!value.table || typeof value.table !== 'object') return false;
    return true;
}

function buildTable(name: string, columnsInput: string, primaryKeyInput: string, sampleRowsInput: string): TableSchema | null {
    const columnNames = parseList(columnsInput);
    if (!name.trim() || columnNames.length === 0) return null;

    const primaryKeyRaw = parseList(primaryKeyInput);
    const primaryKey = primaryKeyRaw.filter((column) => columnNames.includes(column));

    const columns: Column[] = columnNames.map((columnName) => ({
        name: columnName,
        type: 'text',
        isKey: primaryKey.includes(columnName),
    }));

    return {
        id: uid('table'),
        name: name.trim(),
        columns,
        primaryKey,
        foreignKeys: [],
        fds: [],
        mvds: [],
        sampleData: parseSampleRows(sampleRowsInput, columnNames.length),
    };
}

export default function NormalizerPage() {
    const [activeStage, setActiveStage] = useState<CanvasStage>('UNF');
    const [canvases, setCanvases] = useState<Record<CanvasStage, StageCanvas>>(createEmptyCanvases);
    const [verification, setVerification] = useState<VerificationSummary | null>(null);

    const [tableName, setTableName] = useState('');
    const [columnsInput, setColumnsInput] = useState('id,name');
    const [primaryKeyInput, setPrimaryKeyInput] = useState('id');
    const [sampleRowsInput, setSampleRowsInput] = useState('');

    const activeCanvas = canvases[activeStage];
    const selectedNodeId = activeCanvas.nodes.find((node) => node.selected)?.id ?? null;

    const updateActiveCanvas = useCallback(
        (updater: (canvas: StageCanvas) => StageCanvas) => {
            setCanvases((previous) => ({
                ...previous,
                [activeStage]: updater(previous[activeStage]),
            }));
        },
        [activeStage],
    );

    const onNodesChange = useCallback(
        (changes: NodeChange<Node<CanvasNodeData>>[]) => {
            updateActiveCanvas((canvas) => ({
                ...canvas,
                nodes: applyNodeChanges(changes, canvas.nodes),
            }));
        },
        [updateActiveCanvas],
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange<Edge>[]) => {
            updateActiveCanvas((canvas) => ({
                ...canvas,
                edges: applyEdgeChanges(changes, canvas.edges),
            }));
        },
        [updateActiveCanvas],
    );

    const onConnect = useCallback(
        (connection: Connection) => {
            updateActiveCanvas((canvas) => ({
                ...canvas,
                edges: addEdge(
                    {
                        ...connection,
                        type: 'smoothstep',
                        animated: true,
                        style: {
                            stroke: 'color-mix(in oklab, var(--warning) 55%, var(--border))',
                            strokeWidth: 1.6,
                        },
                    },
                    canvas.edges,
                ),
            }));
        },
        [updateActiveCanvas],
    );

    const addTable = useCallback(() => {
        const table = buildTable(tableName, columnsInput, primaryKeyInput, sampleRowsInput);
        if (!table) return;

        const node: Node<CanvasNodeData> = {
            id: table.id,
            position: {
                x: 80 + activeCanvas.nodes.length * 36,
                y: 70 + activeCanvas.nodes.length * 28,
            },
            data: {
                table,
                label: renderTableLabel(table),
            },
            style: {
                border: 'none',
                background: 'transparent',
                padding: 0,
            },
            draggable: true,
            selectable: true,
        };

        updateActiveCanvas((canvas) => ({
            ...canvas,
            nodes: [...canvas.nodes, node],
        }));

        setTableName('');
        setSampleRowsInput('');
    }, [activeCanvas.nodes.length, columnsInput, primaryKeyInput, sampleRowsInput, tableName, updateActiveCanvas]);

    const removeSelected = useCallback(() => {
        if (!selectedNodeId) return;

        updateActiveCanvas((canvas) => ({
            ...canvas,
            nodes: canvas.nodes.filter((node) => node.id !== selectedNodeId),
            edges: canvas.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
        }));
    }, [selectedNodeId, updateActiveCanvas]);

    const clearCurrentCanvas = useCallback(() => {
        updateActiveCanvas(() => ({ nodes: [], edges: [] }));
    }, [updateActiveCanvas]);

    const verify = useCallback(() => {
        const stages: StageVerification[] = STAGES.map((stage) => {
            const checks: TableVerification[] = canvases[stage].nodes
                .filter((node) => isCanvasNodeData(node.data))
                .map((node) => {
                    const table = node.data.table;
                    const detected = detectNormalForm(table);
                    return {
                        tableName: table.name,
                        detected,
                        ok: stageSatisfied(stage, detected),
                    };
                });

            return {
                stage,
                checks,
                pass: checks.length > 0 && checks.every((check) => check.ok),
            };
        });

        setVerification({
            allPass: stages.every((stage) => stage.pass),
            stages,
        });
    }, [canvases]);

    return (
        <ReactFlowProvider>
            <div className="flex h-full flex-col gap-3 p-4 lg:p-6">
                <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div
                                className="rounded-xl p-2"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(249, 115, 22, 0.1) 100%)',
                                }}
                            >
                                <Database className="h-5 w-5 text-amber-300" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground">Normalizer Studio</h1>
                                <p className="text-xs text-muted-foreground">Create tables in each canvas and verify.</p>
                            </div>
                        </div>

                        <button
                            onClick={verify}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                                boxShadow: '0 14px 34px -20px rgba(249, 115, 22, 0.8)',
                            }}
                        >
                            <ShieldCheck className="h-4 w-4" />
                            Verify
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {STAGES.map((stage) => {
                            const status = verification?.stages.find((item) => item.stage === stage);
                            return (
                                <button
                                    key={stage}
                                    onClick={() => setActiveStage(stage)}
                                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors"
                                    style={{
                                        borderColor: activeStage === stage
                                            ? 'color-mix(in oklab, var(--warning) 55%, var(--border))'
                                            : 'color-mix(in oklab, var(--border) 85%, transparent)',
                                        background: activeStage === stage
                                            ? 'color-mix(in oklab, var(--warning) 17%, transparent)'
                                            : 'color-mix(in oklab, var(--surface-soft) 68%, transparent)',
                                        color: 'var(--foreground)',
                                    }}
                                >
                                    {stage}
                                    {status && (
                                        status.pass
                                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                                            : <XCircle className="h-3.5 w-3.5 text-rose-300" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/70 p-3">
                    <div className="grid gap-2 lg:grid-cols-[1fr_1.5fr_1fr_auto_auto]">
                        <input
                            value={tableName}
                            onChange={(event) => setTableName(event.target.value)}
                            placeholder="Table name"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                        />
                        <input
                            value={columnsInput}
                            onChange={(event) => setColumnsInput(event.target.value)}
                            placeholder="Columns: id,name,dept"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                        />
                        <input
                            value={primaryKeyInput}
                            onChange={(event) => setPrimaryKeyInput(event.target.value)}
                            placeholder="Primary key: id"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                        />

                        <button
                            onClick={addTable}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add table
                        </button>

                        <button
                            onClick={removeSelected}
                            disabled={!selectedNodeId}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                        </button>
                    </div>

                    <textarea
                        value={sampleRowsInput}
                        onChange={(event) => setSampleRowsInput(event.target.value)}
                        placeholder="Optional sample rows (comma separated, one row per line)"
                        className="mt-2 min-h-16 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none"
                    />

                    <div className="mt-2 flex items-center justify-end">
                        <button
                            onClick={clearCurrentCanvas}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                            Clear {activeStage} canvas
                        </button>
                    </div>
                </div>

                <div className="normalizer-canvas-wrapper min-h-[460px] flex-1 overflow-hidden rounded-2xl border border-border bg-card/70">
                    <ReactFlow
                        nodes={activeCanvas.nodes}
                        edges={activeCanvas.edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        fitViewOptions={{ padding: 0.25 }}
                        minZoom={0.2}
                        maxZoom={2.5}
                        nodeDragThreshold={1}
                        deleteKeyCode={['Backspace', 'Delete']}
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

                {verification && (
                    <div className="rounded-2xl border border-border bg-card/70 p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                            {verification.allPass
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                : <XCircle className="h-4 w-4 text-rose-300" />}
                            {verification.allPass ? 'All canvases verified' : 'Verification failed'}
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {verification.stages.map((stage) => (
                                <div
                                    key={stage.stage}
                                    className="rounded-xl border px-3 py-2"
                                    style={{
                                        borderColor: stage.pass
                                            ? 'color-mix(in oklab, var(--success) 45%, var(--border))'
                                            : 'color-mix(in oklab, var(--danger) 45%, var(--border))',
                                        background: stage.pass
                                            ? 'color-mix(in oklab, var(--success) 10%, transparent)'
                                            : 'color-mix(in oklab, var(--danger) 10%, transparent)',
                                    }}
                                >
                                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground">
                                        <span>{stage.stage}</span>
                                        <span>{stage.checks.filter((item) => item.ok).length}/{stage.checks.length}</span>
                                    </div>

                                    {stage.checks.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground">No tables in this canvas.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {stage.checks.map((check) => (
                                                <div key={`${stage.stage}_${check.tableName}`} className="flex items-center justify-between text-[11px]">
                                                    <span className="truncate text-foreground/90">{check.tableName}</span>
                                                    <span className={check.ok ? 'text-emerald-300' : 'text-rose-300'}>{check.detected}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ReactFlowProvider>
    );
}
