'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, KeyRound, Link2, Table2 } from 'lucide-react';
import type { NormalForm, TableSchema } from '@/types/normalizer';

interface TableNodeData {
    table: TableSchema;
    normalForm: NormalForm;
    showSampleData: boolean;
    hasViolation: boolean;
    highlightedColumns: string[];
}

const FALLBACK_TABLE: TableSchema = {
    id: 'table',
    name: 'Table',
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    fds: [],
    mvds: [],
    sampleData: [],
};

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNormalForm(value: unknown): value is NormalForm {
    return value === 'UNF'
        || value === '1NF'
        || value === '2NF'
        || value === '3NF'
        || value === 'BCNF'
        || value === '4NF'
        || value === '5NF';
}

function isTableSchema(value: unknown): value is TableSchema {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;

    return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && Array.isArray(candidate.columns)
        && Array.isArray(candidate.primaryKey)
        && Array.isArray(candidate.foreignKeys)
        && Array.isArray(candidate.fds)
        && Array.isArray(candidate.mvds);
}

function parseTableNodeData(data: unknown): TableNodeData {
    if (!data || typeof data !== 'object') {
        return {
            table: FALLBACK_TABLE,
            normalForm: 'UNF',
            showSampleData: false,
            hasViolation: false,
            highlightedColumns: [],
        };
    }

    const value = data as Record<string, unknown>;
    const table = isTableSchema(value.table) ? value.table : FALLBACK_TABLE;

    return {
        table,
        normalForm: isNormalForm(value.normalForm) ? value.normalForm : 'UNF',
        showSampleData: typeof value.showSampleData === 'boolean' ? value.showSampleData : false,
        hasViolation: typeof value.hasViolation === 'boolean' ? value.hasViolation : false,
        highlightedColumns: isStringArray(value.highlightedColumns) ? value.highlightedColumns : [],
    };
}

export const TableNode = memo(function TableNode({ data }: NodeProps) {
    const parsedData = parseTableNodeData(data);

    const {
        table,
        normalForm,
        showSampleData,
        hasViolation,
        highlightedColumns,
    } = parsedData;

    const [expanded, setExpanded] = useState(false);

    const fkColumns = new Set<string>();
    for (const foreignKey of table.foreignKeys) {
        for (const column of foreignKey.columns) {
            fkColumns.add(column);
        }
    }

    const visibleRows = table.sampleData?.slice(0, 5) ?? [];

    return (
        <div className="relative" style={{ minWidth: 280, maxWidth: 360 }}>
            {hasViolation && (
                <div
                    className="pointer-events-none absolute -inset-1 rounded-2xl opacity-65 blur-md"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(249, 115, 22, 0.12) 100%)',
                    }}
                />
            )}

            <div
                className="relative overflow-hidden rounded-2xl border bg-card/90 shadow-lg backdrop-blur-sm"
                style={{
                    borderColor: hasViolation
                        ? 'color-mix(in oklab, var(--warning) 48%, var(--border))'
                        : 'color-mix(in oklab, var(--border) 90%, transparent)',
                    boxShadow: hasViolation
                        ? '0 18px 40px -24px color-mix(in oklab, var(--warning) 56%, transparent)'
                        : '0 14px 36px -28px var(--shadow-color)',
                }}
            >
                <div
                    className="flex items-center justify-between border-b px-3 py-2"
                    style={{
                        borderColor: 'color-mix(in oklab, var(--border) 85%, transparent)',
                        background:
                            'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(249, 115, 22, 0.08) 100%)',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-amber-400/30 bg-amber-500/15 p-1 text-amber-300">
                            <Table2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{table.name}</p>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">{table.columns.length} columns</p>
                        </div>
                    </div>

                    <span className="rounded-md border border-amber-500/30 bg-amber-500/12 px-2 py-1 text-[10px] font-bold tracking-wide text-amber-300">
                        {normalForm}
                    </span>
                </div>

                <div className="max-h-64 overflow-auto px-2 py-2">
                    {table.columns.map((column) => {
                        const isPrimary = table.primaryKey.includes(column.name);
                        const isForeign = fkColumns.has(column.name);
                        const highlighted = highlightedColumns.includes(column.name);

                        return (
                            <div
                                key={`${table.id}_${column.name}`}
                                className="mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"
                                style={{
                                    borderColor: highlighted
                                        ? 'color-mix(in oklab, var(--warning) 58%, var(--border))'
                                        : 'color-mix(in oklab, var(--border) 85%, transparent)',
                                    background: highlighted
                                        ? 'color-mix(in oklab, var(--warning) 14%, transparent)'
                                        : 'color-mix(in oklab, var(--surface-soft) 82%, transparent)',
                                }}
                            >
                                {isPrimary ? (
                                    <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                                ) : isForeign ? (
                                    <Link2 className="h-3.5 w-3.5 text-sky-300" />
                                ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                )}

                                <span className="font-medium text-foreground/95">{column.name}</span>
                                {column.type && (
                                    <span className="ml-auto rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground/90">
                                        {column.type}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {showSampleData && (
                    <div className="border-t" style={{ borderColor: 'color-mix(in oklab, var(--border) 85%, transparent)' }}>
                        <button
                            onClick={() => setExpanded((value) => !value)}
                            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                            <span>Sample data</span>
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>

                        {expanded && (
                            <div className="max-h-40 overflow-auto border-t px-2 py-2" style={{ borderColor: 'color-mix(in oklab, var(--border) 75%, transparent)' }}>
                                {visibleRows.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground/80">
                                        No sample rows.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {visibleRows.map((row, rowIndex) => (
                                            <div
                                                key={`${table.id}_row_${rowIndex}`}
                                                className="rounded-lg border border-border/75 bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground"
                                            >
                                                {row.map((cell, cellIndex) => (
                                                    <span key={`${table.id}_cell_${rowIndex}_${cellIndex}`} className="mr-2 inline-block max-w-[140px] truncate align-middle">
                                                        {cell || 'NULL'}
                                                    </span>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Handle type="target" position={Position.Left} isConnectable={false} className="!opacity-0" />
            <Handle type="source" position={Position.Right} isConnectable={false} className="!opacity-0" />
            <Handle type="target" position={Position.Top} id="top" isConnectable={false} className="!opacity-0" />
            <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={false} className="!opacity-0" />
        </div>
    );
});
