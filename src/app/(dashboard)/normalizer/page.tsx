'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
    type NodeProps,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Check,
    CheckCircle2,
    ChevronDown,
    Database,
    Download,
    Plus,
    ShieldCheck,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { generateTableDataRows, type GeneratorTableDef } from '@/lib/engine/data-generator';
import { verifyNormalFormStrict, type VerificationConfidence } from '@/lib/engine/normalizer-engine';
import { useGeneratorStore } from '@/stores/generator-store';
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
    confidence: VerificationConfidence;
    ok: boolean;
    warnings: string[];
    reason?: string;
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
const TABLE_HINT_TEXT = 'Paste CSV or Excel rows. First row must be column names.';
const TABLE_TEMPLATE_TEXT = ['id,name,department', '1,Alice,CS', '2,Bob,IT', '3,Charlie,ECE'].join('\n');

const STAGE_MIN_INDEX: Record<CanvasStage, number> = {
    UNF: 0,
    '1NF': 1,
    '2NF': 2,
    '3NF': 3,
    '4NF': 5,
    '5NF': 6,
};

const STAGE_FAILURE_HINTS: Record<Exclude<CanvasStage, 'UNF'>, string> = {
    '1NF': 'still contains repeating groups or multi-valued attributes.',
    '2NF': 'still has partial dependency issues on composite keys.',
    '3NF': 'still has transitive dependency issues.',
    '4NF': 'still has multivalued dependency issues.',
    '5NF': 'still has unresolved join dependency issues.',
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

function parseLines(input: string): string[] {
    return input
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function countDelimiterOutsideQuotes(line: string, delimiter: ',' | '\t'): number {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            const nextChar = line[index + 1];
            if (inQuotes && nextChar === '"') {
                index += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }

        if (!inQuotes && char === delimiter) {
            count += 1;
        }
    }

    return count;
}

function parseRow(line: string, delimiter: ',' | '\t'): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === '"') {
            const nextChar = line[index + 1];
            if (inQuotes && nextChar === '"') {
                current += '"';
                index += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }

        if (!inQuotes && char === delimiter) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
}

function normalizeHeaderRow(headerRow: string[]): string[] {
    const seen = new Map<string, number>();

    return headerRow.map((value, index) => {
        const base = value.length > 0 ? value : `col_${index + 1}`;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        if (count === 0) return base;
        return `${base}_${count + 1}`;
    });
}

function detectDelimiter(header: string): ',' | '\t' {
    const commaCount = countDelimiterOutsideQuotes(header, ',');
    const tabCount = countDelimiterOutsideQuotes(header, '\t');
    if (tabCount > commaCount) return '\t';
    return ',';
}

function parseTableText(input: string): { columns: string[]; rows: string[][] } | null {
    const lines = parseLines(input);
    if (lines.length === 0) return null;

    const delimiter = detectDelimiter(lines[0]);
    const columns = normalizeHeaderRow(parseRow(lines[0], delimiter));
    if (columns.length === 0) return null;

    const rows = lines
        .slice(1)
        .map((line) => parseRow(line, delimiter))
        .map((row) => Array.from({ length: columns.length }, (_, index) => row[index] ?? ''))
        .filter((row) => row.some((value) => value.length > 0));

    return { columns, rows };
}

function hasUniqueValues(columnIndex: number, rows: string[][]): boolean {
    if (rows.length === 0) return false;
    const seen = new Set<string>();

    for (const row of rows) {
        const value = row[columnIndex] ?? '';
        if (!value || seen.has(value)) return false;
        seen.add(value);
    }

    return true;
}

function inferPrimaryKey(columns: string[], rows: string[][]): string[] {
    if (columns.length === 0) return [];

    const idIndex = columns.findIndex((column) => /^id$/i.test(column) || /_id$/i.test(column));
    if (idIndex >= 0 && hasUniqueValues(idIndex, rows)) {
        return [columns[idIndex]];
    }

    for (let index = 0; index < columns.length; index += 1) {
        if (hasUniqueValues(index, rows)) {
            return [columns[index]];
        }
    }

    if (idIndex >= 0) return [columns[idIndex]];
    return [columns[0]];
}

function buildTableFromText(name: string, text: string, fallbackIndex: number): TableSchema | null {
    const parsed = parseTableText(text);
    if (!parsed || parsed.rows.length === 0) return null;

    const primaryKey = inferPrimaryKey(parsed.columns, parsed.rows);
    const columns: Column[] = parsed.columns.map((columnName) => ({
        name: columnName,
        type: 'text',
        isKey: primaryKey.includes(columnName),
    }));

    return {
        id: uid('table'),
        name: name.trim() || `Table_${fallbackIndex}`,
        columns,
        primaryKey,
        foreignKeys: [],
        fds: [],
        mvds: [],
        sampleData: parsed.rows,
    };
}

function buildBlankTable(name: string, fallbackIndex: number): TableSchema {
    const columns: Column[] = [
        { name: 'id', type: 'text', isKey: true },
        { name: 'value_1', type: 'text', isKey: false },
        { name: 'value_2', type: 'text', isKey: false },
    ];

    return {
        id: uid('table'),
        name: name.trim() || `Table_${fallbackIndex}`,
        columns,
        primaryKey: ['id'],
        foreignKeys: [],
        fds: [],
        mvds: [],
        sampleData: [
            ['1', '', ''],
            ['2', '', ''],
            ['3', '', ''],
        ],
    };
}

function buildTableFromGenerator(source: GeneratorTableDef, fallbackIndex: number, overrideName?: string): TableSchema {
    const sampleData = generateTableDataRows(source);
    const columnNames = source.columns.map((column) => column.name);
    const sourcePrimaryKey = source.columns.filter((column) => column.primaryKey).map((column) => column.name);
    const primaryKey = sourcePrimaryKey.length > 0
        ? sourcePrimaryKey
        : inferPrimaryKey(columnNames, sampleData);

    const columns: Column[] = source.columns.map((column) => ({
        name: column.name,
        type: column.type,
        isKey: primaryKey.includes(column.name),
    }));

    const foreignKeys = source.columns
        .filter((column) => !!column.foreignKey)
        .map((column) => ({
            columns: [column.name],
            referencesTable: column.foreignKey!.table,
            referencesColumns: [column.foreignKey!.column],
        }));

    return {
        id: uid('table'),
        name: (overrideName ?? source.name).trim() || `Table_${fallbackIndex}`,
        columns,
        primaryKey,
        foreignKeys,
        fds: [],
        mvds: [],
        sampleData,
    };
}

function rowCount(table: TableSchema): number {
    return table.sampleData?.length ?? 0;
}

function estimateColumnWidths(table: TableSchema): number[] {
    const rows = table.sampleData ?? [];

    return table.columns.map((column, columnIndex) => {
        let maxLength = column.name.length;

        for (const row of rows) {
            const valueLength = (row[columnIndex] ?? '').length;
            if (valueLength > maxLength) {
                maxLength = valueLength;
            }
        }

        const widthFromChars = maxLength * 8.2 + 56;
        return Math.max(170, Math.min(460, widthFromChars));
    });
}

function renderTableLabel(table: TableSchema): ReactNode {
    const rows = table.sampleData ?? [];
    const totalRows = rowCount(table);
    const columnCount = Math.max(1, table.columns.length);
    const columnWidths = estimateColumnWidths(table);
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const cardWidth = Math.max(560, tableWidth + 32);

    return (
        <div
            className="rounded-2xl border border-amber-400/35 bg-card/95 p-3 text-left shadow-[0_24px_52px_-34px_rgba(245,158,11,0.7)] backdrop-blur-sm"
            style={{ width: `${cardWidth}px` }}
        >
            <div className="mb-2.5 flex items-center justify-between border-b border-border/85 pb-2.5">
                <div className="min-w-0">
                    <h3 className="truncate text-[24px] font-extrabold tracking-tight text-foreground">{table.name}</h3>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                        {table.columns.length} columns
                    </p>
                </div>
                <span className="rounded-xl border border-amber-400/35 bg-amber-500/16 px-2.5 py-1 text-[14px] font-bold text-amber-300">
                    {totalRows} rows
                </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/85 bg-card/80">
                <div className="max-h-[360px] overflow-x-hidden overflow-y-auto">
                    <table className="table-fixed border-separate border-spacing-0 text-xs" style={{ width: `${tableWidth}px`, minWidth: '100%' }}>
                        <colgroup>
                            {columnWidths.map((width, index) => (
                                <col key={`${table.id}_col_${index}`} style={{ width: `${width}px` }} />
                            ))}
                        </colgroup>
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-muted/75 backdrop-blur-sm">
                                {table.columns.map((column) => (
                                    <th
                                        key={`${table.id}_head_${column.name}`}
                                        className="border-b border-border/90 px-3 py-2 text-left text-[12px] font-bold text-foreground"
                                    >
                                        <span className="block whitespace-pre-wrap break-words">{column.name}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-3 py-3 text-[12px] font-medium text-muted-foreground"
                                    >
                                        No rows yet
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, rowIndex) => (
                                    <tr
                                        key={`${table.id}_row_${rowIndex}`}
                                        className={rowIndex % 2 === 0
                                            ? 'bg-card/30'
                                            : 'bg-muted/15'}
                                    >
                                        {table.columns.map((column, columnIndex) => (
                                            <td
                                                key={`${table.id}_cell_${rowIndex}_${column.name}`}
                                                className="border-b border-border/70 px-3 py-2 align-top text-[12px] leading-relaxed text-foreground/85"
                                            >
                                                <span className="block min-h-[1.2rem] whitespace-pre-wrap break-words">
                                                    {row[columnIndex] || '-'}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
                {table.primaryKey.map((column) => (
                    <span
                        key={`${table.id}_pk_${column}`}
                        className="rounded-lg border border-amber-400/35 bg-amber-500/12 px-2 py-1 text-xs font-bold text-amber-300"
                    >
                        PK: {column}
                    </span>
                ))}
            </div>
        </div>
    );
}

function TableCanvasNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
    return (
        <div className={selected ? 'rounded-[1.15rem] ring-2 ring-amber-300/45' : undefined}>
            {data.label}
        </div>
    );
}

const NODE_TYPES = {
    table: TableCanvasNode,
} satisfies NodeTypes;

function stageSatisfied(stage: CanvasStage, detected: NormalForm): boolean {
    if (stage === 'UNF') return detected === 'UNF';
    return ENGINE_ORDER.indexOf(detected) >= STAGE_MIN_INDEX[stage];
}

function formatDetectedForStage(stage: CanvasStage, detected: NormalForm): string {
    if (stage === 'UNF') return detected;

    const detectedIndex = ENGINE_ORDER.indexOf(detected);
    const stageIndex = STAGE_MIN_INDEX[stage];
    if (detectedIndex > stageIndex) {
        return `${stage}+`;
    }

    return detected;
}

function buildFailureReason(stage: CanvasStage, detected: NormalForm): string {
    if (stage === 'UNF') {
        return `Expected UNF, but detected ${detected}. This table appears more normalized than UNF and does not contain repeating or multi-valued groups.`;
    }

    const expectedIndex = STAGE_MIN_INDEX[stage];
    const detectedIndex = ENGINE_ORDER.indexOf(detected);
    const base = `Expected at least ${stage}, but detected ${detected}.`;

    if (detectedIndex < expectedIndex) {
        return `${base} It likely ${STAGE_FAILURE_HINTS[stage]}`;
    }

    return base;
}

function isCanvasNodeData(data: unknown): data is CanvasNodeData {
    if (!data || typeof data !== 'object') return false;
    const value = data as Record<string, unknown>;
    if (!value.table || typeof value.table !== 'object') return false;
    return true;
}

export default function NormalizerPage() {
    const generatorTables = useGeneratorStore((state) => state.tables);

    const [activeStage, setActiveStage] = useState<CanvasStage>('UNF');
    const [canvases, setCanvases] = useState<Record<CanvasStage, StageCanvas>>(createEmptyCanvases);
    const [verification, setVerification] = useState<VerificationSummary | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [openFailureReasons, setOpenFailureReasons] = useState<Record<string, boolean>>({});

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [draftTableName, setDraftTableName] = useState('');
    const [draftTableText, setDraftTableText] = useState('');
    const [selectedGeneratorIndex, setSelectedGeneratorIndex] = useState('0');
    const [isGeneratorMenuOpen, setIsGeneratorMenuOpen] = useState(false);
    const [createTableError, setCreateTableError] = useState('');
    const generatorMenuRef = useRef<HTMLDivElement | null>(null);

    const activeCanvas = canvases[activeStage];
    const stableNodeTypes = useMemo(() => NODE_TYPES, []);
    const selectedGeneratorTable = useMemo(() => {
        const index = Number(selectedGeneratorIndex);
        if (!Number.isInteger(index) || index < 0 || index >= generatorTables.length) {
            return null;
        }
        return generatorTables[index] as GeneratorTableDef;
    }, [generatorTables, selectedGeneratorIndex]);

    const activeCanvasNodes = useMemo(
        () => activeCanvas.nodes.map((node) => (node.type === 'table' ? node : { ...node, type: 'table' })),
        [activeCanvas.nodes],
    );
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

    const addTableToActiveCanvas = useCallback((table: TableSchema) => {
        setVerification(null);

        const node: Node<CanvasNodeData> = {
            id: table.id,
            type: 'table',
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
    }, [activeCanvas.nodes.length, updateActiveCanvas]);

    const closeCreateDialog = useCallback(() => {
        setIsCreateDialogOpen(false);
        setCreateTableError('');
    }, []);

    const openCreateDialog = useCallback(() => {
        setIsCreateDialogOpen(true);
        setCreateTableError('');
        setSelectedGeneratorIndex('0');
        setIsGeneratorMenuOpen(false);
    }, []);

    const createFromPastedData = useCallback(() => {
        const table = buildTableFromText(draftTableName, draftTableText, activeCanvas.nodes.length + 1);
        if (!table) {
            setCreateTableError('Paste header and data rows before creating the table.');
            return;
        }

        addTableToActiveCanvas(table);
        closeCreateDialog();
        setDraftTableName('');
        setDraftTableText('');
    }, [activeCanvas.nodes.length, addTableToActiveCanvas, closeCreateDialog, draftTableName, draftTableText]);

    const createBlank = useCallback(() => {
        const table = buildBlankTable(draftTableName, activeCanvas.nodes.length + 1);
        addTableToActiveCanvas(table);
        closeCreateDialog();
        setDraftTableName('');
        setDraftTableText('');
    }, [activeCanvas.nodes.length, addTableToActiveCanvas, closeCreateDialog, draftTableName]);

    const useTemplate = useCallback(() => {
        setDraftTableText(TABLE_TEMPLATE_TEXT);
        setCreateTableError('');
    }, []);

    const importFromGenerator = useCallback(() => {
        if (generatorTables.length === 0) {
            setCreateTableError('No tables found in Table Generator. Create tables there first.');
            return;
        }

        const index = Number(selectedGeneratorIndex);
        if (!Number.isInteger(index) || index < 0 || index >= generatorTables.length) {
            setCreateTableError('Select a valid generator table to import.');
            return;
        }

        const source = generatorTables[index];
        const table = buildTableFromGenerator(source, activeCanvas.nodes.length + 1, draftTableName);

        addTableToActiveCanvas(table);
        closeCreateDialog();
        setDraftTableName('');
        setDraftTableText('');
        setIsGeneratorMenuOpen(false);
    }, [activeCanvas.nodes.length, addTableToActiveCanvas, closeCreateDialog, draftTableName, generatorTables, selectedGeneratorIndex]);

    useEffect(() => {
        if (!isGeneratorMenuOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!(event.target instanceof Element) || !generatorMenuRef.current?.contains(event.target)) {
                setIsGeneratorMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsGeneratorMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isGeneratorMenuOpen]);

    const removeSelected = useCallback(() => {
        if (!selectedNodeId) return;
        setVerification(null);

        updateActiveCanvas((canvas) => ({
            ...canvas,
            nodes: canvas.nodes.filter((node) => node.id !== selectedNodeId),
            edges: canvas.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
        }));
    }, [selectedNodeId, updateActiveCanvas]);

    const clearCurrentCanvas = useCallback(() => {
        setVerification(null);
        updateActiveCanvas(() => ({ nodes: [], edges: [] }));
    }, [updateActiveCanvas]);

    const verify = useCallback(() => {
        const stages: StageVerification[] = STAGES.map((stage) => {
            const checks: TableVerification[] = canvases[stage].nodes
                .filter((node) => isCanvasNodeData(node.data))
                .map((node) => {
                    const table = node.data.table;
                    const verification = verifyNormalFormStrict(table);
                    const detected = verification.detectedNF;
                    const ok = stageSatisfied(stage, detected);

                    const warningText = verification.warnings.join(' ');
                    const failureReason = buildFailureReason(stage, detected);

                    return {
                        tableName: table.name,
                        detected,
                        confidence: verification.confidence,
                        ok,
                        warnings: verification.warnings,
                        reason: ok
                            ? undefined
                            : warningText.length > 0
                                ? `${failureReason} ${warningText}`
                                : failureReason,
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

        setOpenFailureReasons({});
        setIsVerificationModalOpen(true);
    }, [canvases]);

    const toggleFailureReason = useCallback((key: string) => {
        setOpenFailureReasons((previous) => ({
            ...previous,
            [key]: !previous[key],
        }));
    }, []);

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
                                <p className="text-xs text-muted-foreground">Use real row data tables in each canvas, then verify.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={openCreateDialog}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300"
                            >
                                <Plus className="h-4 w-4" />
                                Add table
                            </button>

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

                <div className="normalizer-canvas-wrapper min-h-[460px] flex-1 overflow-hidden rounded-2xl border border-border bg-card/70">
                    <ReactFlow
                        nodes={activeCanvasNodes}
                        edges={activeCanvas.edges}
                        nodeTypes={stableNodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodesConnectable={false}
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

                <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/70 p-3">
                    <button
                        onClick={removeSelected}
                        disabled={!selectedNodeId}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove selected
                    </button>

                    <button
                        onClick={clearCurrentCanvas}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                        Clear {activeStage} canvas
                    </button>
                </div>

                {isVerificationModalOpen && verification && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                        onClick={() => setIsVerificationModalOpen(false)}
                    >
                        <div
                            className="w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between border-b border-border px-5 py-4">
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Verification Summary</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">Review pass/fail by stage and inspect failure reasons.</p>
                                </div>

                                <button
                                    onClick={() => setIsVerificationModalOpen(false)}
                                    className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    aria-label="Close verification popup"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="max-h-[calc(86vh-88px)] overflow-y-auto p-4">
                                <div className="mb-4 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Overall</p>
                                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                                            {verification.allPass
                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                                : <XCircle className="h-4 w-4 text-rose-300" />}
                                            {verification.allPass ? 'Passed' : 'Failed'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stages Passed</p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                            {verification.stages.filter((stage) => stage.pass).length}/{verification.stages.length}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tables Checked</p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                            {verification.stages.reduce((total, stage) => total + stage.checks.length, 0)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 lg:grid-cols-2">
                                    {verification.stages.map((stage) => (
                                        <div
                                            key={stage.stage}
                                            className="rounded-xl border px-3 py-3"
                                            style={{
                                                borderColor: stage.pass
                                                    ? 'color-mix(in oklab, var(--success) 45%, var(--border))'
                                                    : 'color-mix(in oklab, var(--danger) 45%, var(--border))',
                                                background: stage.pass
                                                    ? 'color-mix(in oklab, var(--success) 10%, transparent)'
                                                    : 'color-mix(in oklab, var(--danger) 10%, transparent)',
                                            }}
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-foreground">{stage.stage}</span>
                                                <span className="text-xs font-semibold text-foreground">
                                                    {stage.checks.filter((item) => item.ok).length}/{stage.checks.length}
                                                </span>
                                            </div>

                                            {stage.checks.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground">No tables in this canvas.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {stage.checks.map((check, index) => {
                                                        const reasonKey = `${stage.stage}_${check.tableName}_${index}`;
                                                        const isReasonOpen = !!openFailureReasons[reasonKey];

                                                        return (
                                                            <div
                                                                key={reasonKey}
                                                                className="rounded-lg border border-border/75 bg-card/70 px-2.5 py-2"
                                                            >
                                                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                                                    <span className="truncate text-foreground/90">{check.tableName}</span>

                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={check.ok ? 'text-emerald-300' : 'text-rose-300'}
                                                                            title={check.warnings.length > 0
                                                                                ? `Strict verifier (${check.confidence} confidence): ${check.detected}. ${check.warnings.join(' ')}`
                                                                                : `Strict verifier (${check.confidence} confidence): ${check.detected}`}
                                                                        >
                                                                            {formatDetectedForStage(stage.stage, check.detected)}
                                                                        </span>

                                                                        {!check.ok && check.reason && (
                                                                            <button
                                                                                onClick={() => toggleFailureReason(reasonKey)}
                                                                                className="rounded-md border border-rose-500/35 bg-rose-500/12 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20"
                                                                            >
                                                                                {isReasonOpen ? 'Hide reason' : 'Reason'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {!check.ok && check.reason && isReasonOpen && (
                                                                    <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                                                                        {check.reason}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isCreateDialogOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
                        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                                <div>
                                    <h2 className="text-sm font-bold text-foreground">Add table</h2>
                                    <p className="text-xs text-muted-foreground">{TABLE_HINT_TEXT}</p>
                                </div>

                                <button
                                    onClick={closeCreateDialog}
                                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    aria-label="Close add table dialog"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="max-h-[calc(92vh-4.5rem)] space-y-4 overflow-y-auto p-4">
                                <input
                                    value={draftTableName}
                                    onChange={(event) => setDraftTableName(event.target.value)}
                                    placeholder="Table name (optional)"
                                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                                />

                                <textarea
                                    value={draftTableText}
                                    onChange={(event) => {
                                        setDraftTableText(event.target.value);
                                        setCreateTableError('');
                                    }}
                                    placeholder={TABLE_TEMPLATE_TEXT}
                                    className="min-h-56 w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground outline-none"
                                />

                                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                    <p className="mb-2 text-xs font-semibold text-foreground">Import from Table Generator</p>

                                    {generatorTables.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No tables available. Create and save tables in Generator first.</p>
                                    ) : (
                                        <div className="flex flex-wrap items-start gap-2">
                                            <div className="relative min-w-[320px] flex-1" ref={generatorMenuRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsGeneratorMenuOpen((open) => !open)}
                                                    className="group flex w-full items-center justify-between rounded-xl border border-border/80 bg-card px-3 py-2.5 text-left transition-all hover:border-sky-500/45 hover:bg-sky-500/5"
                                                    aria-haspopup="listbox"
                                                    aria-expanded={isGeneratorMenuOpen}
                                                    aria-label="Select table from Table Generator"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-semibold text-foreground">
                                                            {selectedGeneratorTable?.name ?? 'Select a generator table'}
                                                        </p>
                                                        <p className="truncate text-[11px] text-muted-foreground">
                                                            {selectedGeneratorTable
                                                                ? `${selectedGeneratorTable.columns.length} columns • ${selectedGeneratorTable.rowCount} rows`
                                                                : 'Choose one table to import into the current stage'}
                                                        </p>
                                                    </div>

                                                    <ChevronDown
                                                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isGeneratorMenuOpen ? 'rotate-180 text-sky-300' : 'group-hover:text-sky-300'
                                                            }`}
                                                    />
                                                </button>

                                                {isGeneratorMenuOpen && (
                                                    <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-sm">
                                                        <div className="max-h-56 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Generator tables">
                                                            {generatorTables.map((table, index) => {
                                                                const value = String(index);
                                                                const isSelected = value === selectedGeneratorIndex;

                                                                return (
                                                                    <button
                                                                        key={`${table.name}_${index}`}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => {
                                                                            setSelectedGeneratorIndex(value);
                                                                            setCreateTableError('');
                                                                            setIsGeneratorMenuOpen(false);
                                                                        }}
                                                                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${isSelected
                                                                            ? 'border border-sky-500/35 bg-sky-500/15'
                                                                            : 'border border-transparent hover:bg-muted/70'
                                                                            }`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-xs font-semibold text-foreground">{table.name}</p>
                                                                            <p className="truncate text-[11px] text-muted-foreground">
                                                                                {table.columns.length} cols • {table.rowCount} rows
                                                                            </p>
                                                                        </div>

                                                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-sky-300" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={importFromGenerator}
                                                className="inline-flex min-h-[46px] min-w-[320px] flex-1 items-center justify-center gap-2 rounded-xl border border-sky-500/35 bg-sky-500/15 px-3 py-2.5 text-xs font-semibold text-sky-300"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Import table
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {createTableError && (
                                    <p className="text-xs font-semibold text-rose-300">{createTableError}</p>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        onClick={useTemplate}
                                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    >
                                        Use sample data
                                    </button>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={createBlank}
                                            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                        >
                                            Quick blank table
                                        </button>

                                        <button
                                            onClick={createFromPastedData}
                                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Create table
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ReactFlowProvider>
    );
}
