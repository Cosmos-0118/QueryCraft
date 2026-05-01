'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
    type OnInit,
    type OnMoveEnd,
    type ReactFlowInstance,
    type Viewport,
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
import {
    generateMultiTableDataRows,
    generateTableDataRows,
    inferForeignKeys,
    type GeneratorTableDef,
} from '@/lib/engine/data-generator';
import { verifyNormalForm, type VerificationConfidence } from '@/lib/engine/normalizer-engine';
import { getUserKeyForId, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';
import { useAuthStore } from '@/stores/auth-store';
import { useGeneratorStore } from '@/stores/generator-store';
import type { Column, FunctionalDependency, NormalForm, TableSchema } from '@/types/normalizer';

type CanvasStage = 'UNF' | '1NF' | '2NF' | '3NF' | '4NF' | '5NF';

interface CanvasNodeData extends Record<string, unknown> {
    table: TableSchema;
    label: ReactNode;
}

interface StageCanvas {
    nodes: Node<CanvasNodeData>[];
    edges: Edge[];
    viewport?: Viewport;
}

interface TableVerification {
    tableName: string;
    detected: NormalForm;
    confidence: VerificationConfidence;
    ok: boolean;
    warnings: string[];
    reasons: string[];
    candidateKeys: string[][];
    primaryKey: string[];
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

interface GeneratorMenuLayout {
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
}

interface PersistedCanvasNode {
    id: string;
    position: { x: number; y: number };
    size?: {
        width?: number;
        height?: number;
    };
    table: TableSchema;
    selected: boolean;
}

interface PersistedCanvasEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

interface PersistedStageCanvas {
    nodes: PersistedCanvasNode[];
    edges: PersistedCanvasEdge[];
    viewport?: Viewport;
}

interface PersistedNormalizerStudioState {
    version: number;
    savedAt: number;
    activeStage: CanvasStage;
    canvases: Record<CanvasStage, PersistedStageCanvas>;
}

interface PendingNormalizerStudioWrite {
    storageKey: string;
    payload: PersistedNormalizerStudioState;
}

const NORMALIZER_STUDIO_PERSIST_VERSION = 1;
const NORMALIZER_STUDIO_PERSIST_DELAY_MS = 220;
const NORMALIZER_STUDIO_FALLBACK_STAGE: CanvasStage = 'UNF';
const DEFAULT_CANVAS_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

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

function createEmptyPersistedCanvases(): Record<CanvasStage, PersistedStageCanvas> {
    return {
        UNF: { nodes: [], edges: [] },
        '1NF': { nodes: [], edges: [] },
        '2NF': { nodes: [], edges: [] },
        '3NF': { nodes: [], edges: [] },
        '4NF': { nodes: [], edges: [] },
        '5NF': { nodes: [], edges: [] },
    };
}

const CANVAS_NODE_STYLE = {
    border: 'none',
    background: 'transparent',
    padding: 0,
} as const;

const CANVAS_EDGE_STYLE = {
    stroke: 'color-mix(in oklab, var(--warning) 55%, var(--border))',
    strokeWidth: 1.6,
} as const;

const CANVAS_EDGE_LABEL_STYLE = {
    fill: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 600,
} as const;

function getNormalizerStudioStorageKey(storageScopeId: string): string {
    return getUserKeyForId(storageScopeId, STORAGE_BASE_KEYS.normalizerStudio);
}

function isCanvasStage(value: unknown): value is CanvasStage {
    return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function sanitizeNodeDimension(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return clampNumber(value, 80, 8000);
    }

    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return clampNumber(parsed, 80, 8000);
        }
    }

    return null;
}

function sanitizeViewport(value: unknown): Viewport | null {
    if (!isRecord(value)) return null;

    const x = clampNumber(toFiniteNumber(value.x, 0), -200_000, 200_000);
    const y = clampNumber(toFiniteNumber(value.y, 0), -200_000, 200_000);
    const zoom = clampNumber(toFiniteNumber(value.zoom, 1), 0.05, 4);

    return { x, y, zoom };
}

function extractNodeSize(node: Node<CanvasNodeData>): PersistedCanvasNode['size'] | undefined {
    const styleWidth = sanitizeNodeDimension(node.style?.width);
    const styleHeight = sanitizeNodeDimension(node.style?.height);
    const widthFallback = sanitizeNodeDimension((node as { width?: unknown }).width);
    const heightFallback = sanitizeNodeDimension((node as { height?: unknown }).height);
    const measured = (node as { measured?: { width?: unknown; height?: unknown } }).measured;
    const measuredWidth = sanitizeNodeDimension(measured?.width);
    const measuredHeight = sanitizeNodeDimension(measured?.height);

    const width = styleWidth ?? widthFallback ?? measuredWidth;
    const height = styleHeight ?? heightFallback ?? measuredHeight;

    if (!width && !height) return undefined;
    return {
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
    };
}

function toSanitizedCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
        return value.map((entry) => toSanitizedCell(entry)).join('|');
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }
    return String(value);
}

function normalizeUniqueStrings(value: unknown, maxItems = 128): string[] {
    if (!Array.isArray(value)) return [];

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const entry of value) {
        const next = cleanString(entry);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        normalized.push(next);
        if (normalized.length >= maxItems) break;
    }

    return normalized;
}

function sanitizeColumn(column: unknown): Column | null {
    if (!isRecord(column)) return null;
    const name = cleanString(column.name);
    if (!name) return null;

    const type = cleanString(column.type);
    return {
        name,
        ...(type ? { type } : {}),
        isKey: column.isKey === true,
    };
}

function sanitizeFunctionalDependency(
    dependency: unknown,
    validColumns: Set<string>,
): FunctionalDependency | null {
    if (!isRecord(dependency)) return null;

    const determinant = normalizeUniqueStrings(dependency.determinant).filter((attribute) =>
        validColumns.has(attribute),
    );
    const dependent = normalizeUniqueStrings(dependency.dependent)
        .filter((attribute) => validColumns.has(attribute) && !determinant.includes(attribute));

    if (determinant.length === 0 || dependent.length === 0) return null;
    return { determinant, dependent };
}

function sanitizeMultivaluedDependency(
    dependency: unknown,
    validColumns: Set<string>,
): TableSchema['mvds'][number] | null {
    if (!isRecord(dependency)) return null;

    const determinant = normalizeUniqueStrings(dependency.determinant).filter((attribute) =>
        validColumns.has(attribute),
    );
    const dependent = normalizeUniqueStrings(dependency.dependent)
        .filter((attribute) => validColumns.has(attribute) && !determinant.includes(attribute));

    if (determinant.length === 0 || dependent.length === 0) return null;
    return { determinant, dependent };
}

function sanitizeJoinDependency(
    dependency: unknown,
    validColumns: Set<string>,
): NonNullable<TableSchema['joinDependencies']>[number] | null {
    if (!isRecord(dependency)) return null;

    const rawComponents = dependency.components;
    if (!Array.isArray(rawComponents)) return null;

    const components: string[][] = [];
    for (const component of rawComponents) {
        const normalized = normalizeUniqueStrings(component).filter((attribute) => validColumns.has(attribute));
        if (normalized.length > 0) {
            components.push(normalized);
        }
    }

    if (components.length < 2) return null;
    return { components };
}

function sanitizeForeignKey(
    foreignKey: unknown,
    validColumns: Set<string>,
): TableSchema['foreignKeys'][number] | null {
    if (!isRecord(foreignKey)) return null;

    const columns = normalizeUniqueStrings(foreignKey.columns).filter((column) => validColumns.has(column));
    const referencesColumns = normalizeUniqueStrings(foreignKey.referencesColumns);
    const referencesTable = cleanString(foreignKey.referencesTable);

    if (columns.length === 0 || referencesColumns.length === 0 || !referencesTable) {
        return null;
    }

    return {
        columns,
        referencesTable,
        referencesColumns,
    };
}

function sanitizeSampleData(sampleData: unknown, columnCount: number): string[][] {
    if (!Array.isArray(sampleData) || columnCount <= 0) return [];

    const rows: string[][] = [];
    const maxRows = 4000;
    const maxCellLength = 600;

    for (const row of sampleData) {
        if (!Array.isArray(row)) continue;

        const normalizedRow = Array.from({ length: columnCount }, (_, index) =>
            toSanitizedCell(row[index]).slice(0, maxCellLength),
        );

        if (normalizedRow.some((value) => value.trim().length > 0)) {
            rows.push(normalizedRow);
            if (rows.length >= maxRows) break;
        }
    }

    return rows;
}

function sanitizeTableSchema(table: unknown): TableSchema | null {
    if (!isRecord(table)) return null;

    const rawColumns = Array.isArray(table.columns) ? table.columns : [];
    const columns: Column[] = [];
    const seenColumns = new Set<string>();

    for (const rawColumn of rawColumns) {
        const next = sanitizeColumn(rawColumn);
        if (!next || seenColumns.has(next.name)) continue;
        seenColumns.add(next.name);
        columns.push(next);
    }

    if (columns.length === 0) return null;

    const columnNames = columns.map((column) => column.name);
    const columnSet = new Set(columnNames);
    const fallbackPrimaryKey = columnSet.has('id') ? ['id'] : [columnNames[0]];

    const primaryKey = normalizeUniqueStrings(table.primaryKey).filter((attribute) =>
        columnSet.has(attribute),
    );
    const resolvedPrimaryKey = primaryKey.length > 0 ? primaryKey : fallbackPrimaryKey;

    const rawForeignKeys = Array.isArray(table.foreignKeys) ? table.foreignKeys : [];
    const foreignKeys = dedupeForeignKeys(
        rawForeignKeys
            .map((foreignKey) => sanitizeForeignKey(foreignKey, columnSet))
            .filter((foreignKey): foreignKey is TableSchema['foreignKeys'][number] => foreignKey !== null),
    );

    const rawFds = Array.isArray(table.fds) ? table.fds : [];
    const explicitDependencies = rawFds
        .map((dependency) => sanitizeFunctionalDependency(dependency, columnSet))
        .filter((dependency): dependency is FunctionalDependency => dependency !== null);
    const fds = mergeFunctionalDependencies(
        buildPrimaryKeyDependencies(columnNames, resolvedPrimaryKey),
        explicitDependencies,
    );

    const rawMvds = Array.isArray(table.mvds) ? table.mvds : [];
    const mvds = rawMvds
        .map((dependency) => sanitizeMultivaluedDependency(dependency, columnSet))
        .filter((dependency): dependency is TableSchema['mvds'][number] => dependency !== null);

    const rawJoinDependencies = Array.isArray(table.joinDependencies)
        ? table.joinDependencies
        : [];
    const joinDependencies = rawJoinDependencies
        .map((dependency) => sanitizeJoinDependency(dependency, columnSet))
        .filter(
            (
                dependency,
            ): dependency is NonNullable<TableSchema['joinDependencies']>[number] => dependency !== null,
        );

    const id = cleanString(table.id) ?? uid('table');
    const name = cleanString(table.name) ?? id;
    const sampleData = sanitizeSampleData(table.sampleData, columns.length);

    return {
        id,
        name,
        columns: columns.map((column) => ({
            ...column,
            isKey: resolvedPrimaryKey.includes(column.name),
        })),
        primaryKey: resolvedPrimaryKey,
        foreignKeys,
        fds,
        mvds,
        ...(joinDependencies.length > 0 ? { joinDependencies } : {}),
        sampleData,
    };
}

function sanitizePersistedNode(node: unknown): PersistedCanvasNode | null {
    if (!isRecord(node)) return null;

    const table = sanitizeTableSchema(node.table);
    if (!table) return null;

    const fallbackId = table.id;
    const id = cleanString(node.id) ?? fallbackId;
    if (!id) return null;

    const rawPosition = isRecord(node.position) ? node.position : null;
    const x = clampNumber(toFiniteNumber(rawPosition?.x, 0), -40_000, 40_000);
    const y = clampNumber(toFiniteNumber(rawPosition?.y, 0), -40_000, 40_000);
    const rawSize = isRecord(node.size) ? node.size : null;
    const width = sanitizeNodeDimension(rawSize?.width);
    const height = sanitizeNodeDimension(rawSize?.height);

    return {
        id,
        position: { x, y },
        ...(width || height
            ? {
                size: {
                    ...(width ? { width } : {}),
                    ...(height ? { height } : {}),
                },
            }
            : {}),
        table,
        selected: node.selected === true,
    };
}

function sanitizePersistedEdge(edge: unknown, nodeIds: Set<string>): PersistedCanvasEdge | null {
    if (!isRecord(edge)) return null;

    const source = cleanString(edge.source);
    const target = cleanString(edge.target);

    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
        return null;
    }

    const id = cleanString(edge.id) ?? `edge_${source}_${target}`;
    const label = cleanString(edge.label) ?? undefined;

    return { id, source, target, label };
}

function createCanvasNodeFromPersistedNode(node: PersistedCanvasNode): Node<CanvasNodeData> {
    const width = sanitizeNodeDimension(node.size?.width);
    const height = sanitizeNodeDimension(node.size?.height);

    return {
        id: node.id,
        type: 'table',
        position: node.position,
        data: {
            table: node.table,
            label: renderTableLabel(node.table),
        },
        style: {
            ...CANVAS_NODE_STYLE,
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
        },
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        draggable: true,
        selectable: true,
        selected: node.selected,
    };
}

function createCanvasEdgeFromPersistedEdge(edge: PersistedCanvasEdge): Edge {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
        ...(edge.label ? { label: edge.label } : {}),
        style: CANVAS_EDGE_STYLE,
        labelStyle: CANVAS_EDGE_LABEL_STYLE,
    };
}

function serializeCanvasesForPersistence(
    canvases: Record<CanvasStage, StageCanvas>,
): Record<CanvasStage, PersistedStageCanvas> {
    const persisted = createEmptyPersistedCanvases();

    for (const stage of STAGES) {
        const sourceCanvas = canvases[stage];
        const nodes: PersistedCanvasNode[] = [];
        const seenNodeIds = new Set<string>();

        for (const node of sourceCanvas.nodes) {
            if (!isCanvasNodeData(node.data)) continue;

            const table = sanitizeTableSchema(node.data.table);
            if (!table) continue;

            const id = cleanString(node.id) ?? table.id;
            if (!id || seenNodeIds.has(id)) continue;

            seenNodeIds.add(id);
            const size = extractNodeSize(node);
            nodes.push({
                id,
                position: {
                    x: clampNumber(toFiniteNumber(node.position.x, 0), -40_000, 40_000),
                    y: clampNumber(toFiniteNumber(node.position.y, 0), -40_000, 40_000),
                },
                ...(size ? { size } : {}),
                table,
                selected: node.selected === true,
            });
        }

        const nodeIds = new Set(nodes.map((node) => node.id));
        const edges: PersistedCanvasEdge[] = [];
        const seenEdgeIds = new Set<string>();

        for (const edge of sourceCanvas.edges) {
            const source = cleanString(edge.source);
            const target = cleanString(edge.target);
            if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) continue;

            const id = cleanString(edge.id) ?? `edge_${source}_${target}`;
            if (seenEdgeIds.has(id)) continue;
            seenEdgeIds.add(id);

            const label = cleanString(edge.label) ?? undefined;
            edges.push({ id, source, target, ...(label ? { label } : {}) });
        }

        const viewport = sanitizeViewport(sourceCanvas.viewport);

        persisted[stage] = {
            nodes,
            edges,
            ...(viewport ? { viewport } : {}),
        };
    }

    return persisted;
}

function deserializeCanvasesFromPersistence(
    value: unknown,
): Record<CanvasStage, StageCanvas> | null {
    if (!isRecord(value)) return null;

    const canvases = createEmptyCanvases();

    for (const stage of STAGES) {
        const rawStage = value[stage];
        if (!isRecord(rawStage)) continue;

        const rawNodes = Array.isArray(rawStage.nodes) ? rawStage.nodes : [];
        const persistedNodes: PersistedCanvasNode[] = [];
        const seenNodeIds = new Set<string>();

        for (const rawNode of rawNodes) {
            const node = sanitizePersistedNode(rawNode);
            if (!node || seenNodeIds.has(node.id)) continue;

            seenNodeIds.add(node.id);
            persistedNodes.push(node);
        }

        const nodeIds = new Set(persistedNodes.map((node) => node.id));
        const rawEdges = Array.isArray(rawStage.edges) ? rawStage.edges : [];
        const persistedEdges: PersistedCanvasEdge[] = [];
        const seenEdgeIds = new Set<string>();

        for (const rawEdge of rawEdges) {
            const edge = sanitizePersistedEdge(rawEdge, nodeIds);
            if (!edge || seenEdgeIds.has(edge.id)) continue;

            seenEdgeIds.add(edge.id);
            persistedEdges.push(edge);
        }

        const viewport = sanitizeViewport(rawStage.viewport);

        canvases[stage] = {
            nodes: persistedNodes.map(createCanvasNodeFromPersistedNode),
            edges: persistedEdges.map(createCanvasEdgeFromPersistedEdge),
            ...(viewport ? { viewport } : {}),
        };
    }

    return canvases;
}

function writePersistedNormalizerStudioState(
    storageKey: string,
    payload: PersistedNormalizerStudioState,
): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // localStorage unavailable or quota exceeded.
    }
}

function clearPersistedNormalizerStudioState(storageKey: string): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(storageKey);
    } catch {
        // localStorage unavailable.
    }
}

function readPersistedNormalizerStudioState(
    storageKey: string,
): { activeStage: CanvasStage; canvases: Record<CanvasStage, StageCanvas> } | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) {
            clearPersistedNormalizerStudioState(storageKey);
            return null;
        }

        const version = typeof parsed.version === 'number'
            ? parsed.version
            : NORMALIZER_STUDIO_PERSIST_VERSION;
        if (version !== NORMALIZER_STUDIO_PERSIST_VERSION) {
            clearPersistedNormalizerStudioState(storageKey);
            return null;
        }

        const activeStage = isCanvasStage(parsed.activeStage)
            ? parsed.activeStage
            : NORMALIZER_STUDIO_FALLBACK_STAGE;
        const canvases = deserializeCanvasesFromPersistence(parsed.canvases);

        if (!canvases) {
            clearPersistedNormalizerStudioState(storageKey);
            return null;
        }

        return {
            activeStage,
            canvases,
        };
    } catch {
        clearPersistedNormalizerStudioState(storageKey);
        return null;
    }
}

function buildPersistedNormalizerStudioState(
    activeStage: CanvasStage,
    canvases: Record<CanvasStage, StageCanvas>,
): PersistedNormalizerStudioState {
    return {
        version: NORMALIZER_STUDIO_PERSIST_VERSION,
        savedAt: Date.now(),
        activeStage,
        canvases: serializeCanvasesForPersistence(canvases),
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

function normalizeAttributeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isIdentifierLikeColumn(column: string): boolean {
    return /(^id$|_id$|id$|_key$|key$|_code$|code$|_no$|_number$|uuid$)/i.test(column);
}

function* columnCombinations(columns: string[], size: number): Generator<string[]> {
    if (size <= 0 || size > columns.length) return;

    const combo: string[] = [];

    function* dfs(start: number, remaining: number): Generator<string[]> {
        if (remaining === 0) {
            yield [...combo];
            return;
        }

        for (let index = start; index <= columns.length - remaining; index += 1) {
            combo.push(columns[index]);
            yield* dfs(index + 1, remaining - 1);
            combo.pop();
        }
    }

    yield* dfs(0, size);
}

function isUniqueKey(columns: string[], key: string[], rows: string[][]): boolean {
    if (rows.length === 0 || key.length === 0) return false;

    const indexes = key.map((column) => columns.indexOf(column)).filter((index) => index >= 0);
    if (indexes.length !== key.length) return false;

    const seen = new Set<string>();
    for (const row of rows) {
        const tuple = indexes.map((index) => row[index] ?? '').join('\u241F');
        if (seen.has(tuple)) return false;
        seen.add(tuple);
    }

    return true;
}

function collectUniqueCandidates(columns: string[], rows: string[][], maxSize = 3): string[][] {
    const candidates: string[][] = [];
    const bounded = Math.max(1, Math.min(maxSize, columns.length));

    for (let size = 1; size <= bounded; size += 1) {
        for (const combo of columnCombinations(columns, size)) {
            if (isUniqueKey(columns, combo, rows)) {
                candidates.push(combo);
            }
        }
    }

    return candidates;
}

function alignColumnsByName(targetColumns: string[], sourceColumns: string[]): string[] | null {
    const normalizedTargetMap = new Map(
        targetColumns.map((column) => [normalizeAttributeName(column), column]),
    );

    const aligned: string[] = [];
    for (const source of sourceColumns) {
        const target = normalizedTargetMap.get(normalizeAttributeName(source));
        if (!target) return null;
        aligned.push(target);
    }

    return aligned;
}

function tupleSetForColumns(columns: string[], rows: string[][], projectedColumns: string[]): Set<string> {
    const indexes = projectedColumns.map((column) => columns.indexOf(column));
    if (indexes.some((index) => index < 0)) return new Set<string>();

    const tuples = new Set<string>();
    for (const row of rows) {
        const parts = indexes.map((index) => row[index] ?? '');
        if (parts.every((part) => part.trim().length === 0)) continue;
        tuples.add(parts.join('\u241F'));
    }

    return tuples;
}

function rowsReferenceParentKey(
    childColumns: string[],
    childRows: string[][],
    childKeyColumns: string[],
    parentColumns: string[],
    parentRows: string[][],
    parentKeyColumns: string[],
): boolean {
    if (childRows.length === 0) return true;
    if (parentRows.length === 0) return false;

    const childKeys = tupleSetForColumns(childColumns, childRows, childKeyColumns);
    if (childKeys.size === 0) return false;

    const parentKeys = tupleSetForColumns(parentColumns, parentRows, parentKeyColumns);
    if (parentKeys.size === 0) return false;

    for (const tuple of childKeys) {
        if (!parentKeys.has(tuple)) return false;
    }

    return true;
}

function dedupeForeignKeys(
    foreignKeys: Array<{ columns: string[]; referencesTable: string; referencesColumns: string[] }>,
): Array<{ columns: string[]; referencesTable: string; referencesColumns: string[] }> {
    const seen = new Set<string>();
    const deduped: Array<{ columns: string[]; referencesTable: string; referencesColumns: string[] }> = [];

    for (const foreignKey of foreignKeys) {
        const key = `${foreignKey.columns.map(normalizeAttributeName).join('::')}|${normalizeAttributeName(foreignKey.referencesTable)}|${foreignKey.referencesColumns.map(normalizeAttributeName).join('::')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(foreignKey);
    }

    return deduped;
}

function inferForeignKeysFromContext(args: {
    tableName: string;
    columns: string[];
    primaryKey: string[];
    sampleData: string[][];
    contextTables?: TableSchema[];
}): Array<{ columns: string[]; referencesTable: string; referencesColumns: string[] }> {
    const { tableName, columns, primaryKey, sampleData, contextTables = [] } = args;

    const candidatesByChildKey = new Map<string, {
        score: number;
        foreignKey: { columns: string[]; referencesTable: string; referencesColumns: string[] };
    }>();
    const ambiguousChildKeys = new Set<string>();

    for (const parent of contextTables) {
        if (!parent || parent.primaryKey.length === 0) continue;
        if (normalizeAttributeName(parent.name) === normalizeAttributeName(tableName)) continue;

        const alignedChildColumns = alignColumnsByName(columns, parent.primaryKey);
        if (!alignedChildColumns || alignedChildColumns.length === 0) continue;

        const childHasMoreColumns = columns.length > alignedChildColumns.length;
        if (!childHasMoreColumns) continue;

        const parentRows = parent.sampleData ?? [];
        const dataBackedReference = rowsReferenceParentKey(
            columns,
            sampleData,
            alignedChildColumns,
            parent.columns.map((column) => column.name),
            parentRows,
            parent.primaryKey,
        );

        const structuralSignal = alignedChildColumns.some((column) => isIdentifierLikeColumn(column));
        if (!dataBackedReference && !structuralSignal) continue;

        let score = 0;
        if (dataBackedReference) score += 120;
        if (alignedChildColumns.some((column) => primaryKey.includes(column))) score += 20;
        if (alignedChildColumns.every((column) => primaryKey.includes(column))) score += 14;
        score += alignedChildColumns.reduce((sum, column) => sum + (isIdentifierLikeColumn(column) ? 8 : 0), 0);
        score += parent.primaryKey.length === 1 ? 4 : 0;

        const childKey = alignedChildColumns.map(normalizeAttributeName).join('::');
        const foreignKey = {
            columns: alignedChildColumns,
            referencesTable: parent.name,
            referencesColumns: [...parent.primaryKey],
        };

        const previous = candidatesByChildKey.get(childKey);
        if (!previous) {
            candidatesByChildKey.set(childKey, { score, foreignKey });
            continue;
        }

        if (score > previous.score) {
            candidatesByChildKey.set(childKey, { score, foreignKey });
            ambiguousChildKeys.delete(childKey);
            continue;
        }

        if (score === previous.score) {
            ambiguousChildKeys.add(childKey);
        }
    }

    const inferred = Array.from(candidatesByChildKey.entries())
        .filter(([childKey]) => !ambiguousChildKeys.has(childKey))
        .map(([, candidate]) => candidate.foreignKey);

    return dedupeForeignKeys(inferred);
}

function buildPrimaryKeyDependencies(columns: string[], primaryKey: string[]): FunctionalDependency[] {
    if (primaryKey.length === 0) return [];

    const dependents = columns.filter((column) => !primaryKey.includes(column));
    if (dependents.length === 0) return [];

    return [{
        determinant: [...primaryKey],
        dependent: dependents,
    }];
}

function mergeFunctionalDependencies(...groups: FunctionalDependency[][]): FunctionalDependency[] {
    const seen = new Set<string>();
    const merged: FunctionalDependency[] = [];

    for (const group of groups) {
        for (const fd of group) {
            const determinant = Array.from(new Set(fd.determinant));
            const dependent = Array.from(new Set(fd.dependent)).filter((attribute) => !determinant.includes(attribute));
            if (determinant.length === 0 || dependent.length === 0) continue;

            const key = `${determinant.map(normalizeAttributeName).sort().join('::')}->${dependent.map(normalizeAttributeName).sort().join('::')}`;
            if (seen.has(key)) continue;
            seen.add(key);

            merged.push({ determinant, dependent });
        }
    }

    return merged;
}

function reconcileTableWithContext(table: TableSchema, contextTables: TableSchema[]): TableSchema {
    const columns = table.columns.map((column) => column.name);
    const sampleData = table.sampleData ?? [];

    const primaryKey = inferPrimaryKey(columns, sampleData, { contextTables });
    const contextualForeignKeys = inferForeignKeysFromContext({
        tableName: table.name,
        columns,
        primaryKey,
        sampleData,
        contextTables,
    });

    const foreignKeys = dedupeForeignKeys([...(table.foreignKeys ?? []), ...contextualForeignKeys]);
    const fds = mergeFunctionalDependencies(
        buildPrimaryKeyDependencies(columns, primaryKey),
        table.fds ?? [],
    );

    return {
        ...table,
        primaryKey,
        foreignKeys,
        fds,
        columns: table.columns.map((column) => ({
            ...column,
            isKey: primaryKey.includes(column.name),
        })),
    };
}

function inferPrimaryKey(
    columns: string[],
    rows: string[][],
    context?: { contextTables?: TableSchema[] },
): string[] {
    if (columns.length === 0) return [];

    const contextTables = context?.contextTables ?? [];
    const contextKeyColumns = new Set(
        contextTables
            .flatMap((table) => table.primaryKey)
            .map((column) => normalizeAttributeName(column)),
    );

    const isContextKeyColumn = (column: string): boolean => contextKeyColumns.has(normalizeAttributeName(column));

    const scoreKey = (key: string[]): number => {
        const sizePenalty = key.length * 100;
        const identifierBonus = key.reduce((sum, column) => sum + (isIdentifierLikeColumn(column) ? 30 : 0), 0);
        const exactIdBonus = key.some((column) => /^id$/i.test(column)) ? 18 : 0;
        const contextBonus = key.reduce((sum, column) => sum + (isContextKeyColumn(column) ? 95 : 0), 0);
        const nonIdentifierPenalty = key.reduce((sum, column) => sum + (!isIdentifierLikeColumn(column) ? 6 : 0), 0);

        return sizePenalty - identifierBonus - exactIdBonus - contextBonus + nonIdentifierPenalty;
    };

    const uniqueSingles = columns
        .filter((column, index) => hasUniqueValues(index, rows))
        .map((column) => [column]);

    const uniqueCandidates = collectUniqueCandidates(columns, rows, 3);

    if (uniqueSingles.length > 0) {
        const singlesWithStrongSignal = uniqueSingles.filter(([column]) =>
            isIdentifierLikeColumn(column) || isContextKeyColumn(column),
        );

        if (singlesWithStrongSignal.length > 0) {
            return [...singlesWithStrongSignal].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
        }
    }

    if (contextTables.length > 0 && uniqueCandidates.length > 0) {
        const contextualCandidates: string[][] = [];

        for (const table of contextTables) {
            if (table.primaryKey.length === 0) continue;
            const alignedContextKey = alignColumnsByName(columns, table.primaryKey);
            if (!alignedContextKey || alignedContextKey.length === 0) continue;

            if (isUniqueKey(columns, alignedContextKey, rows)) {
                contextualCandidates.push(alignedContextKey);
                continue;
            }

            const supersets = uniqueCandidates.filter((candidate) =>
                alignedContextKey.every((contextColumn) => candidate.includes(contextColumn)),
            );

            if (supersets.length > 0) {
                contextualCandidates.push(
                    [...supersets].sort((left, right) => scoreKey(left) - scoreKey(right))[0],
                );
            }
        }

        const contextual = contextualCandidates.length > 0
            ? contextualCandidates
            : uniqueCandidates.filter((key) => key.some((column) => isContextKeyColumn(column)));

        if (contextual.length > 0) {
            const bestContextual = [...contextual].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
            const bestSingle = uniqueSingles.length > 0
                ? [...uniqueSingles].sort((left, right) => scoreKey(left) - scoreKey(right))[0]
                : null;

            if (!bestSingle) {
                return bestContextual;
            }

            const singleIsWeak = bestSingle.every((column) =>
                !isIdentifierLikeColumn(column) && !isContextKeyColumn(column),
            );

            if (singleIsWeak || scoreKey(bestContextual) <= scoreKey(bestSingle) + 40) {
                return bestContextual;
            }
        }
    }

    const hasIdentifierWithDuplicates = columns.some((column, index) =>
        isIdentifierLikeColumn(column) && !hasUniqueValues(index, rows),
    );

    if (hasIdentifierWithDuplicates) {
        const identifierComposites = uniqueCandidates.filter((key) =>
            key.length > 1 && key.some((column) => isIdentifierLikeColumn(column)),
        );

        if (identifierComposites.length > 0) {
            return [...identifierComposites].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
        }
    }

    if (uniqueSingles.length > 0) {
        return [...uniqueSingles].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
    }

    if (uniqueCandidates.length > 0) {
        return [...uniqueCandidates].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
    }

    for (let index = 0; index < columns.length; index += 1) {
        if (/^id$/i.test(columns[index]) || /_id$/i.test(columns[index])) {
            return [columns[index]];
        }
    }

    return [columns[0]];
}

function buildTableFromText(
    name: string,
    text: string,
    fallbackIndex: number,
    contextTables?: TableSchema[],
): TableSchema | null {
    const parsed = parseTableText(text);
    if (!parsed || parsed.rows.length === 0) return null;

    const primaryKey = inferPrimaryKey(parsed.columns, parsed.rows, { contextTables });
    const foreignKeys = inferForeignKeysFromContext({
        tableName: name.trim() || `Table_${fallbackIndex}`,
        columns: parsed.columns,
        primaryKey,
        sampleData: parsed.rows,
        contextTables,
    });

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
        foreignKeys,
        fds: buildPrimaryKeyDependencies(parsed.columns, primaryKey),
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

function normalizeGeneratorToken(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function singularizeGeneratorToken(value: string): string {
    if (value.endsWith('ies') && value.length > 3) {
        return `${value.slice(0, -3)}y`;
    }

    if (value.endsWith('ses') && value.length > 3) {
        return value.slice(0, -2);
    }

    if (value.endsWith('s') && !value.endsWith('ss') && value.length > 2) {
        return value.slice(0, -1);
    }

    return value;
}

function dependencyHolds(
    determinant: string[],
    dependent: string[],
    columnIndexes: Map<string, number>,
    rows: string[][],
): boolean {
    if (rows.length === 0) return true;

    const determinantIndexes = determinant.map((attribute) => columnIndexes.get(attribute) ?? -1);
    const dependentIndexes = dependent.map((attribute) => columnIndexes.get(attribute) ?? -1);
    if (determinantIndexes.some((index) => index < 0) || dependentIndexes.some((index) => index < 0)) {
        return false;
    }

    const observed = new Map<string, string>();
    for (const row of rows) {
        const key = determinantIndexes.map((index) => row[index] ?? '').join('\u241F');
        const value = dependentIndexes.map((index) => row[index] ?? '').join('\u241F');
        const previous = observed.get(key);
        if (previous !== undefined && previous !== value) {
            return false;
        }
        observed.set(key, value);
    }

    return true;
}

function buildGeneratorDependencies(
    table: GeneratorTableDef,
    primaryKey: string[],
    foreignKeys: Array<{ columns: string[]; referencesTable: string; referencesColumns: string[] }>,
    sampleData: string[][],
): FunctionalDependency[] {
    const columnNames = table.columns.map((column) => column.name);
    const columnIndexes = new Map(columnNames.map((column, index) => [column, index]));
    const dependencies: FunctionalDependency[] = [];
    const seen = new Set<string>();

    const addDependency = (determinant: string[], dependent: string[]) => {
        const normalizedDeterminant = Array.from(new Set(determinant)).filter((attribute) => columnIndexes.has(attribute));
        const normalizedDependent = Array.from(new Set(dependent))
            .filter((attribute) => columnIndexes.has(attribute) && !normalizedDeterminant.includes(attribute));

        if (normalizedDeterminant.length === 0 || normalizedDependent.length === 0) return;

        const key = `${[...normalizedDeterminant].sort().join('::')}->${[...normalizedDependent].sort().join('::')}`;
        if (seen.has(key)) return;

        seen.add(key);
        dependencies.push({
            determinant: normalizedDeterminant,
            dependent: normalizedDependent,
        });
    };

    if (primaryKey.length > 0) {
        addDependency(
            primaryKey,
            columnNames.filter((columnName) => !primaryKey.includes(columnName)),
        );
    }

    const idLikeColumns = columnNames.filter((columnName) => /(^id$|_id$)/i.test(columnName));
    for (const determinant of idLikeColumns) {
        const normalized = normalizeGeneratorToken(determinant);
        const prefix = normalized === 'id'
            ? ''
            : normalized.endsWith('_id')
                ? normalized.slice(0, -3)
                : normalized;
        if (!prefix) continue;

        const dependents = columnNames.filter((columnName) => {
            const normalizedColumn = normalizeGeneratorToken(columnName);
            if (columnName === determinant) return false;
            if (normalizedColumn.endsWith('_id')) return false;
            return normalizedColumn.startsWith(`${prefix}_`);
        });

        const consistentDependents = dependents.filter((dependent) =>
            dependencyHolds([determinant], [dependent], columnIndexes, sampleData),
        );

        addDependency([determinant], consistentDependents);
    }

    for (const foreignKey of foreignKeys) {
        if (foreignKey.columns.length !== 1) continue;

        const localKeyColumn = foreignKey.columns[0];
        const parentPrefix = singularizeGeneratorToken(normalizeGeneratorToken(foreignKey.referencesTable));
        if (!parentPrefix) continue;

        const dependents = columnNames.filter((columnName) => {
            if (columnName === localKeyColumn) return false;
            const normalized = normalizeGeneratorToken(columnName);
            if (normalized.endsWith('_id')) return false;
            return normalized.startsWith(`${parentPrefix}_`);
        });

        const consistentDependents = dependents.filter((dependent) =>
            dependencyHolds([localKeyColumn], [dependent], columnIndexes, sampleData),
        );

        addDependency([localKeyColumn], consistentDependents);
    }

    return dependencies;
}

function buildTableFromGenerator(
    allGeneratorTables: GeneratorTableDef[],
    sourceIndex: number,
    fallbackIndex: number,
    overrideName?: string,
    contextTables?: TableSchema[],
): TableSchema {
    const resolvedTables = inferForeignKeys(allGeneratorTables);
    const source = resolvedTables[sourceIndex] ?? allGeneratorTables[sourceIndex];
    const sampleDataByTable = generateMultiTableDataRows(resolvedTables);
    const sampleData = sampleDataByTable[source.name] ?? generateTableDataRows(source);
    const columnNames = source.columns.map((column) => column.name);
    const sourcePrimaryKey = source.columns.filter((column) => column.primaryKey).map((column) => column.name);
    const primaryKey = sourcePrimaryKey.length > 0
        ? sourcePrimaryKey
        : inferPrimaryKey(columnNames, sampleData, { contextTables });

    const columns: Column[] = source.columns.map((column) => ({
        name: column.name,
        type: column.type,
        isKey: primaryKey.includes(column.name),
    }));

    const sourceForeignKeys = source.columns
        .filter((column) => !!column.foreignKey)
        .map((column) => ({
            columns: [column.name],
            referencesTable: column.foreignKey!.table,
            referencesColumns: [column.foreignKey!.column],
        }));

    const contextualForeignKeys = inferForeignKeysFromContext({
        tableName: (overrideName ?? source.name).trim() || `Table_${fallbackIndex}`,
        columns: columnNames,
        primaryKey,
        sampleData,
        contextTables,
    });

    const foreignKeys = dedupeForeignKeys([...sourceForeignKeys, ...contextualForeignKeys]);

    const fds = buildGeneratorDependencies(source, primaryKey, foreignKeys, sampleData);

    return {
        id: uid('table'),
        name: (overrideName ?? source.name).trim() || `Table_${fallbackIndex}`,
        columns,
        primaryKey,
        foreignKeys,
        fds,
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
                <div>
                    <table className="table-fixed border-separate border-spacing-0 text-xs" style={{ width: `${tableWidth}px`, minWidth: '100%' }}>
                        <colgroup>
                            {columnWidths.map((width, index) => (
                                <col key={`${table.id}_col_${index}`} style={{ width: `${width}px` }} />
                            ))}
                        </colgroup>
                        <thead>
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

                {table.foreignKeys.map((foreignKey, index) => (
                    <span
                        key={`${table.id}_fk_${index}_${foreignKey.columns.join('_')}`}
                        className="rounded-lg border border-sky-400/35 bg-sky-500/12 px-2 py-1 text-xs font-semibold text-sky-300"
                    >
                        FK: {foreignKey.columns.join(', ')} {'->'} {foreignKey.referencesTable}({foreignKey.referencesColumns.join(', ')})
                    </span>
                ))}
            </div>
        </div>
    );
}

function buildForeignKeyEdgesForNode(
    node: Node<CanvasNodeData>,
    existingNodes: Node<CanvasNodeData>[],
    existingEdges: Edge[],
): Edge[] {
    if (!isCanvasNodeData(node.data) || node.data.table.foreignKeys.length === 0) return [];

    const nameToNode = new Map(
        existingNodes
            .filter((candidate) => isCanvasNodeData(candidate.data))
            .map((candidate) => [normalizeAttributeName(candidate.data.table.name), candidate]),
    );

    const nextEdges: Edge[] = [];

    for (let index = 0; index < node.data.table.foreignKeys.length; index += 1) {
        const foreignKey = node.data.table.foreignKeys[index];
        const targetNode = nameToNode.get(normalizeAttributeName(foreignKey.referencesTable));
        if (!targetNode) continue;

        const edgeId = `fk_${node.id}_${targetNode.id}_${foreignKey.columns.join('_')}_${index}`;
        const alreadyExists = existingEdges.some((edge) => edge.id === edgeId)
            || nextEdges.some((edge) => edge.id === edgeId);
        if (alreadyExists) continue;

        nextEdges.push({
            id: edgeId,
            source: node.id,
            target: targetNode.id,
            type: 'smoothstep',
            animated: true,
            label: `FK: ${foreignKey.columns.join(', ')} -> ${foreignKey.referencesTable}`,
            style: CANVAS_EDGE_STYLE,
            labelStyle: CANVAS_EDGE_LABEL_STYLE,
        });
    }

    return nextEdges;
}

function reconcileCanvasesWithContext(canvases: Record<CanvasStage, StageCanvas>): Record<CanvasStage, StageCanvas> {
    const next = createEmptyCanvases();

    for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex += 1) {
        const stage = STAGES[stageIndex];
        const previousTables = STAGES
            .slice(0, stageIndex)
            .flatMap((previousStage) => next[previousStage].nodes)
            .filter((node) => isCanvasNodeData(node.data))
            .map((node) => node.data.table);

        const sourceStage = canvases[stage];
        const reconciledNodes: Node<CanvasNodeData>[] = [];

        for (const sourceNode of sourceStage.nodes) {
            if (!isCanvasNodeData(sourceNode.data)) {
                reconciledNodes.push(sourceNode);
                continue;
            }

            const siblingTables = reconciledNodes
                .filter((node) => isCanvasNodeData(node.data))
                .map((node) => node.data.table);

            const contextTables = [...siblingTables, ...previousTables];
            const reconciledTable = reconcileTableWithContext(sourceNode.data.table, contextTables);

            reconciledNodes.push({
                ...sourceNode,
                data: {
                    ...sourceNode.data,
                    table: reconciledTable,
                    label: renderTableLabel(reconciledTable),
                },
            });
        }

        let reconciledEdges = [...sourceStage.edges];
        for (const node of reconciledNodes) {
            const relatedNodes = reconciledNodes.filter((candidate) => candidate.id !== node.id);
            const inferredEdges = buildForeignKeyEdgesForNode(node, relatedNodes, reconciledEdges);
            reconciledEdges = [...reconciledEdges, ...inferredEdges];
        }

        next[stage] = {
            nodes: reconciledNodes,
            edges: reconciledEdges,
        };
    }

    return next;
}

function TableCanvasNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
    return (
        <div className={selected ? 'rounded-[1.15rem] ring-2 ring-amber-300/45' : undefined}>
            {data.label}
        </div>
    );
}

const NODE_TYPES = Object.freeze({
    table: TableCanvasNode,
}) satisfies NodeTypes;

const FLOW_PRO_OPTIONS = { hideAttribution: true } as const;

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
    const storageScopeId = useAuthStore((state) => state.user?.id ?? 'guest');
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
    const [generatorMenuPlacement, setGeneratorMenuPlacement] = useState<'top' | 'bottom'>('bottom');
    const [generatorMenuLayout, setGeneratorMenuLayout] = useState<GeneratorMenuLayout | null>(null);
    const [createTableError, setCreateTableError] = useState('');
    const generatorMenuRef = useRef<HTMLDivElement | null>(null);
    const generatorMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
    const generatorMenuDropdownRef = useRef<HTMLDivElement | null>(null);
    const normalizerStudioHydratedRef = useRef(false);
    const skipNextNormalizerStudioPersistRef = useRef(true);
    const normalizerStudioWriteTimerRef = useRef<number | null>(null);
    const pendingNormalizerStudioWriteRef = useRef<PendingNormalizerStudioWrite | null>(null);
    const reactFlowInstanceRef = useRef<ReactFlowInstance<Node<CanvasNodeData>, Edge> | null>(null);

    const flushPendingNormalizerStudioWrite = useCallback(() => {
        if (typeof window === 'undefined') return;

        if (normalizerStudioWriteTimerRef.current !== null) {
            window.clearTimeout(normalizerStudioWriteTimerRef.current);
            normalizerStudioWriteTimerRef.current = null;
        }

        const pending = pendingNormalizerStudioWriteRef.current;
        if (!pending) return;

        writePersistedNormalizerStudioState(pending.storageKey, pending.payload);
        pendingNormalizerStudioWriteRef.current = null;
    }, []);

    useEffect(() => {
        normalizerStudioHydratedRef.current = false;
        skipNextNormalizerStudioPersistRef.current = true;
        flushPendingNormalizerStudioWrite();

        const storageKey = getNormalizerStudioStorageKey(storageScopeId);
        const restored = readPersistedNormalizerStudioState(storageKey);
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            if (restored) {
                setActiveStage(restored.activeStage);
                setCanvases(reconcileCanvasesWithContext(restored.canvases));
            } else {
                setActiveStage(NORMALIZER_STUDIO_FALLBACK_STAGE);
                setCanvases(createEmptyCanvases());
            }

            setVerification(null);
            setIsVerificationModalOpen(false);
            setOpenFailureReasons({});
            normalizerStudioHydratedRef.current = true;
        });

        return () => {
            cancelled = true;
            flushPendingNormalizerStudioWrite();
        };
    }, [flushPendingNormalizerStudioWrite, storageScopeId]);

    useEffect(() => {
        if (!normalizerStudioHydratedRef.current || typeof window === 'undefined') return;

        if (skipNextNormalizerStudioPersistRef.current) {
            skipNextNormalizerStudioPersistRef.current = false;
            return;
        }

        const storageKey = getNormalizerStudioStorageKey(storageScopeId);
        const payload = buildPersistedNormalizerStudioState(activeStage, canvases);

        pendingNormalizerStudioWriteRef.current = { storageKey, payload };

        if (normalizerStudioWriteTimerRef.current !== null) {
            window.clearTimeout(normalizerStudioWriteTimerRef.current);
        }

        normalizerStudioWriteTimerRef.current = window.setTimeout(() => {
            const pending = pendingNormalizerStudioWriteRef.current;
            if (!pending) return;

            writePersistedNormalizerStudioState(pending.storageKey, pending.payload);
            pendingNormalizerStudioWriteRef.current = null;
            normalizerStudioWriteTimerRef.current = null;
        }, NORMALIZER_STUDIO_PERSIST_DELAY_MS);
    }, [activeStage, canvases, storageScopeId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const flushOnUnload = () => {
            flushPendingNormalizerStudioWrite();
        };

        window.addEventListener('beforeunload', flushOnUnload);
        return () => {
            window.removeEventListener('beforeunload', flushOnUnload);
            flushPendingNormalizerStudioWrite();
        };
    }, [flushPendingNormalizerStudioWrite]);

    const activeCanvas = canvases[activeStage];
    const previousStageTables = useMemo(() => {
        const currentStageIndex = STAGES.indexOf(activeStage);
        if (currentStageIndex <= 0) return [];

        return STAGES
            .slice(0, currentStageIndex)
            .flatMap((stage) => canvases[stage].nodes)
            .filter((node) => isCanvasNodeData(node.data))
            .map((node) => node.data.table);
    }, [activeStage, canvases]);

    const currentCanvasTables = useMemo(
        () => activeCanvas.nodes
            .filter((node) => isCanvasNodeData(node.data))
            .map((node) => node.data.table),
        [activeCanvas.nodes],
    );

    const keyContextTables = useMemo(() => {
        const byId = new Map<string, TableSchema>();
        for (const table of [...currentCanvasTables, ...previousStageTables]) {
            byId.set(table.id, table);
        }
        return Array.from(byId.values());
    }, [currentCanvasTables, previousStageTables]);

    const selectedGeneratorTable = useMemo(() => {
        const index = Number(selectedGeneratorIndex);
        if (!Number.isInteger(index) || index < 0 || index >= generatorTables.length) {
            return null;
        }
        return generatorTables[index] as GeneratorTableDef;
    }, [generatorTables, selectedGeneratorIndex]);

    const closeGeneratorMenu = useCallback(() => {
        setIsGeneratorMenuOpen(false);
        setGeneratorMenuLayout(null);
    }, []);

    const updateGeneratorMenuPlacement = useCallback(() => {
        const trigger = generatorMenuTriggerRef.current;
        if (!trigger || typeof window === 'undefined') {
            setGeneratorMenuPlacement('bottom');
            setGeneratorMenuLayout(null);
            return;
        }

        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 12;
        const menuGap = 6;
        const estimatedMenuHeight = Math.min(320, Math.max(140, generatorTables.length * 56));

        const maxLeft = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
        const left = Math.min(Math.max(viewportPadding, rect.left), maxLeft);
        const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);

        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
        const spaceAbove = rect.top - viewportPadding;
        const shouldPlaceTop = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

        if (shouldPlaceTop) {
            const maxHeight = Math.max(96, Math.min(320, spaceAbove - menuGap));
            setGeneratorMenuPlacement('top');
            setGeneratorMenuLayout({
                left,
                width,
                bottom: Math.max(viewportPadding, window.innerHeight - rect.top + menuGap),
                maxHeight,
            });
            return;
        }

        setGeneratorMenuPlacement('bottom');
        setGeneratorMenuLayout({
            left,
            width,
            top: Math.max(viewportPadding, rect.bottom + menuGap),
            maxHeight: Math.max(96, Math.min(320, spaceBelow - menuGap)),
        });
    }, [generatorTables.length]);

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

    const onFlowMoveEnd = useCallback<OnMoveEnd>(
        (_event, viewport) => {
            const normalizedViewport = sanitizeViewport(viewport);
            if (!normalizedViewport) return;

            updateActiveCanvas((canvas) => {
                const currentViewport = sanitizeViewport(canvas.viewport);
                if (
                    currentViewport
                    && Math.abs(currentViewport.x - normalizedViewport.x) < 0.01
                    && Math.abs(currentViewport.y - normalizedViewport.y) < 0.01
                    && Math.abs(currentViewport.zoom - normalizedViewport.zoom) < 0.0001
                ) {
                    return canvas;
                }

                return {
                    ...canvas,
                    viewport: normalizedViewport,
                };
            });
        },
        [updateActiveCanvas],
    );

    const onFlowInit = useCallback<OnInit<Node<CanvasNodeData>, Edge>>((instance) => {
        reactFlowInstanceRef.current = instance;
    }, []);

    useEffect(() => {
        const instance = reactFlowInstanceRef.current;
        if (!instance) return;

        const targetViewport = sanitizeViewport(activeCanvas.viewport) ?? DEFAULT_CANVAS_VIEWPORT;
        void instance.setViewport(targetViewport, { duration: 0 });
    }, [activeCanvas.viewport, activeStage]);

    const onConnect = useCallback(
        (connection: Connection) => {
            updateActiveCanvas((canvas) => ({
                ...canvas,
                edges: addEdge(
                    {
                        ...connection,
                        type: 'smoothstep',
                        animated: true,
                        style: CANVAS_EDGE_STYLE,
                    },
                    canvas.edges,
                ),
            }));
        },
        [updateActiveCanvas],
    );

    const addTableToActiveCanvas = useCallback((table: TableSchema) => {
        setVerification(null);

        const node = createCanvasNodeFromPersistedNode({
            id: table.id,
            position: {
                x: 80 + activeCanvas.nodes.length * 36,
                y: 70 + activeCanvas.nodes.length * 28,
            },
            table,
            selected: false,
        });

        updateActiveCanvas((canvas) => {
            const nextNodes = [...canvas.nodes, node];
            const foreignKeyEdges = buildForeignKeyEdgesForNode(node, canvas.nodes, canvas.edges);

            return {
                ...canvas,
                nodes: nextNodes,
                edges: [...canvas.edges, ...foreignKeyEdges],
            };
        });
    }, [activeCanvas.nodes.length, updateActiveCanvas]);

    const closeCreateDialog = useCallback(() => {
        setIsCreateDialogOpen(false);
        setCreateTableError('');
        closeGeneratorMenu();
    }, [closeGeneratorMenu]);

    const openCreateDialog = useCallback(() => {
        setIsCreateDialogOpen(true);
        setCreateTableError('');
        setSelectedGeneratorIndex('0');
        closeGeneratorMenu();
    }, [closeGeneratorMenu]);

    const createFromPastedData = useCallback(() => {
        const table = buildTableFromText(
            draftTableName,
            draftTableText,
            activeCanvas.nodes.length + 1,
            keyContextTables,
        );
        if (!table) {
            setCreateTableError('Paste header and data rows before creating the table.');
            return;
        }

        addTableToActiveCanvas(table);
        closeCreateDialog();
        setDraftTableName('');
        setDraftTableText('');
    }, [activeCanvas.nodes.length, addTableToActiveCanvas, closeCreateDialog, draftTableName, draftTableText, keyContextTables]);

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

        const table = buildTableFromGenerator(
            generatorTables,
            index,
            activeCanvas.nodes.length + 1,
            draftTableName,
            keyContextTables,
        );

        addTableToActiveCanvas(table);
        closeCreateDialog();
        setDraftTableName('');
        setDraftTableText('');
        closeGeneratorMenu();
    }, [activeCanvas.nodes.length, addTableToActiveCanvas, closeCreateDialog, closeGeneratorMenu, draftTableName, generatorTables, keyContextTables, selectedGeneratorIndex]);

    useEffect(() => {
        if (!isGeneratorMenuOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) {
                closeGeneratorMenu();
                return;
            }

            const withinTrigger = generatorMenuRef.current?.contains(event.target) ?? false;
            const withinDropdown = generatorMenuDropdownRef.current?.contains(event.target) ?? false;

            if (!withinTrigger && !withinDropdown) {
                closeGeneratorMenu();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeGeneratorMenu();
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeGeneratorMenu, isGeneratorMenuOpen]);

    useEffect(() => {
        if (!isGeneratorMenuOpen) return;

        const handleRelayout = () => {
            updateGeneratorMenuPlacement();
        };

        window.addEventListener('resize', handleRelayout);
        window.addEventListener('scroll', handleRelayout, true);

        return () => {
            window.removeEventListener('resize', handleRelayout);
            window.removeEventListener('scroll', handleRelayout, true);
        };
    }, [isGeneratorMenuOpen, updateGeneratorMenuPlacement]);

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
        const reconciledCanvases = reconcileCanvasesWithContext(canvases);
        setCanvases(reconciledCanvases);

        const stages: StageVerification[] = STAGES.map((stage) => {
            const checks: TableVerification[] = reconciledCanvases[stage].nodes
                .filter((node) => isCanvasNodeData(node.data))
                .map((node) => {
                    const table = node.data.table;
                    const report = verifyNormalForm(table);
                    const detected = report.detectedNF;
                    const ok = stageSatisfied(stage, detected);

                    const warningText = report.warnings.join(' ');
                    const failureReason = buildFailureReason(stage, detected);

                    return {
                        tableName: table.name,
                        detected,
                        confidence: report.confidence,
                        ok,
                        warnings: report.warnings,
                        reasons: report.reasons,
                        candidateKeys: report.candidateKeys,
                        primaryKey: report.primaryKey,
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
                        nodeTypes={NODE_TYPES}
                        onInit={onFlowInit}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onMoveEnd={onFlowMoveEnd}
                        onConnect={onConnect}
                        nodesConnectable={false}
                        minZoom={0.2}
                        maxZoom={2.5}
                        nodeDragThreshold={1}
                        deleteKeyCode={['Backspace', 'Delete']}
                        proOptions={FLOW_PRO_OPTIONS}
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
                                                        const hasDetail = check.reasons.length > 0
                                                            || check.warnings.length > 0
                                                            || check.candidateKeys.length > 0
                                                            || (!check.ok && !!check.reason);

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
                                                                            title={`Detected ${check.detected} (${check.confidence} confidence)`}
                                                                        >
                                                                            {formatDetectedForStage(stage.stage, check.detected)}
                                                                        </span>

                                                                        <span
                                                                            className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                                                                            title="Verification confidence based on declared and inferred evidence"
                                                                        >
                                                                            {check.confidence}
                                                                        </span>

                                                                        {hasDetail && (
                                                                            <button
                                                                                onClick={() => toggleFailureReason(reasonKey)}
                                                                                className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${check.ok
                                                                                    ? 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                                                                    : 'border-rose-500/35 bg-rose-500/12 text-rose-300 hover:bg-rose-500/20'}`}
                                                                            >
                                                                                {isReasonOpen ? 'Hide details' : 'Details'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {isReasonOpen && hasDetail && (
                                                                    <div className="mt-2 space-y-2">
                                                                        {!check.ok && check.reason && (
                                                                            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                                                                                {check.reason}
                                                                            </div>
                                                                        )}

                                                                        {check.candidateKeys.length > 0 && (
                                                                            <div className="rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px]">
                                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                                                    Candidate keys
                                                                                </p>
                                                                                <p className="mt-0.5 text-foreground/85">
                                                                                    {check.candidateKeys.map((key) => `(${key.join(', ')})`).join(' • ')}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {check.reasons.length > 0 && (
                                                                            <div className="rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px]">
                                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                                                    Reasoning
                                                                                </p>
                                                                                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-foreground/85">
                                                                                    {check.reasons.map((reason, reasonIndex) => (
                                                                                        <li key={`${reasonKey}_reason_${reasonIndex}`}>{reason}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        {check.warnings.length > 0 && (
                                                                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/90">
                                                                                    Warnings
                                                                                </p>
                                                                                <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                                                                                    {check.warnings.map((warning, warningIndex) => (
                                                                                        <li key={`${reasonKey}_warn_${warningIndex}`}>{warning}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
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
                                                    ref={generatorMenuTriggerRef}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isGeneratorMenuOpen) {
                                                            closeGeneratorMenu();
                                                            return;
                                                        }

                                                        updateGeneratorMenuPlacement();
                                                        setIsGeneratorMenuOpen(true);
                                                    }}
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

                {isCreateDialogOpen && isGeneratorMenuOpen && generatorMenuLayout && typeof document !== 'undefined' && createPortal(
                    <div
                        ref={generatorMenuDropdownRef}
                        className={`fixed z-[80] rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-sm ${generatorMenuPlacement === 'top' ? 'origin-bottom' : 'origin-top'}`}
                        style={{
                            left: generatorMenuLayout.left,
                            width: generatorMenuLayout.width,
                            top: generatorMenuLayout.top,
                            bottom: generatorMenuLayout.bottom,
                        }}
                    >
                        <div
                            className="space-y-1 overflow-y-auto pr-1"
                            style={{ maxHeight: `${generatorMenuLayout.maxHeight}px` }}
                            role="listbox"
                            aria-label="Generator tables"
                        >
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
                                            closeGeneratorMenu();
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
                    </div>,
                    document.body,
                )}
            </div>
        </ReactFlowProvider>
    );
}
