'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchSeedDatasets, type SeedDataset } from '@/lib/seed-datasets';
import { inferFunctionalDependencies } from '@/lib/engine/normalizer-engine';
import {
    buildNormalizerTableFromRecords,
    useNormalizerStore,
} from '@/stores/normalizer-store';
import type { FunctionalDependency, TableSchema } from '@/types/normalizer';
import {
    ArrowDown,
    ArrowUp,
    Database,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react';

function cloneTable(table: TableSchema): TableSchema {
    return {
        ...table,
        columns: table.columns.map((column) => ({ ...column })),
        primaryKey: [...table.primaryKey],
        foreignKeys: table.foreignKeys.map((foreignKey) => ({
            columns: [...foreignKey.columns],
            referencesTable: foreignKey.referencesTable,
            referencesColumns: [...foreignKey.referencesColumns],
        })),
        fds: table.fds.map((fd) => ({
            determinant: [...fd.determinant],
            dependent: [...fd.dependent],
        })),
        mvds: table.mvds.map((mvd) => ({
            determinant: [...mvd.determinant],
            dependent: [...mvd.dependent],
        })),
        joinDependencies: table.joinDependencies?.map((jd) => ({
            components: jd.components.map((component) => [...component]),
        })),
        sampleData: table.sampleData?.map((row) => [...row]),
    };
}

function parsePastedGrid(value: string): string[][] {
    const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return lines.map((line) => {
        if (line.includes('\t')) {
            return line.split('\t').map((cell) => cell.trim());
        }
        return line.split(',').map((cell) => cell.trim());
    });
}

function recordsFromDataset(dataset: SeedDataset, tableName: string): Record<string, unknown>[] {
    const table = dataset.data?.[tableName];
    if (!Array.isArray(table)) return [];
    return table.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row));
}

export function InputPanel() {
    const {
        inputTable,
        setInputTable,
        showFDs,
    } = useNormalizerStore();

    const [determinantDraft, setDeterminantDraft] = useState<string[]>([]);
    const [dependentDraft, setDependentDraft] = useState<string[]>([]);
    const [pasteBuffer, setPasteBuffer] = useState('');

    const [datasets, setDatasets] = useState<SeedDataset[]>([]);
    const [selectedDatasetName, setSelectedDatasetName] = useState('');
    const [selectedDatasetTable, setSelectedDatasetTable] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetchSeedDatasets(controller.signal)
            .then((payload) => setDatasets(payload))
            .catch(() => setDatasets([]));

        return () => controller.abort();
    }, []);

    const selectedDataset = datasets.find((dataset) => dataset.name === selectedDatasetName);
    const selectedDatasetTables = useMemo(() => {
        if (!selectedDataset) return [];
        return Object.keys(selectedDataset.data).sort((a, b) => a.localeCompare(b));
    }, [selectedDataset]);

    const autoInferredFDs = useMemo(() => {
        if (!inputTable || !inputTable.sampleData) return [];
        const columns = inputTable.columns.map((column) => column.name);
        return inferFunctionalDependencies(columns, inputTable.sampleData);
    }, [inputTable]);

    const updateTable = (updater: (table: TableSchema) => TableSchema) => {
        if (!inputTable) return;
        const next = updater(cloneTable(inputTable));
        setInputTable(next);
    };

    if (!inputTable) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="rounded-xl border border-border bg-muted/50 p-3 text-muted-foreground">
                    <Database className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground/85">No table selected</p>
                <p className="text-xs text-muted-foreground">Load a preset from the toolbar to start editing.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/90">Input panel</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{inputTable.name}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-4">
                <section>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Table</p>
                    <input
                        value={inputTable.name}
                        onChange={(event) => updateTable((table) => ({ ...table, name: event.target.value }))}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                        placeholder="Table name"
                    />
                </section>

                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Columns</p>
                        <button
                            onClick={() => updateTable((table) => {
                                const name = `column_${table.columns.length + 1}`;
                                const columns = [...table.columns, { name, type: 'text', isKey: false }];
                                const sampleData = (table.sampleData ?? []).map((row) => [...row, '']);
                                return { ...table, columns, sampleData };
                            })}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                        </button>
                    </div>

                    <div className="space-y-2">
                        {inputTable.columns.map((column, index) => (
                            <div key={`${column.name}_${index}`} className="rounded-lg border border-border bg-muted/35 px-2 py-2">
                                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                                    <input
                                        value={column.name}
                                        onChange={(event) => updateTable((table) => {
                                            const previousName = table.columns[index]?.name;
                                            table.columns[index].name = event.target.value;
                                            table.primaryKey = table.primaryKey.map((value) => (value === previousName ? event.target.value : value));
                                            table.fds = table.fds.map((fd) => ({
                                                determinant: fd.determinant.map((value) => (value === previousName ? event.target.value : value)),
                                                dependent: fd.dependent.map((value) => (value === previousName ? event.target.value : value)),
                                            }));
                                            return table;
                                        })}
                                        className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none"
                                    />

                                    <select
                                        value={column.type ?? 'text'}
                                        onChange={(event) => updateTable((table) => {
                                            table.columns[index].type = event.target.value;
                                            return table;
                                        })}
                                        className="rounded border border-border bg-card px-2 py-1 text-xs text-muted-foreground outline-none"
                                    >
                                        <option value="text">text</option>
                                        <option value="number">number</option>
                                        <option value="date">date</option>
                                    </select>

                                    <button
                                        onClick={() => updateTable((table) => {
                                            const [removed] = table.columns.splice(index, 1);
                                            table.primaryKey = table.primaryKey.filter((key) => key !== removed.name);
                                            table.fds = table.fds
                                                .map((fd) => ({
                                                    determinant: fd.determinant.filter((value) => value !== removed.name),
                                                    dependent: fd.dependent.filter((value) => value !== removed.name),
                                                }))
                                                .filter((fd) => fd.determinant.length > 0 && fd.dependent.length > 0);
                                            table.sampleData = (table.sampleData ?? []).map((row) => row.filter((_, rowIndex) => rowIndex !== index));
                                            return table;
                                        })}
                                        className="rounded border border-rose-500/40 bg-rose-500/10 p-1 text-rose-300 hover:bg-rose-500/20"
                                        title="Remove column"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-[11px]">
                                    <label className="inline-flex items-center gap-1 text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={inputTable.primaryKey.includes(column.name)}
                                            onChange={(event) => updateTable((table) => {
                                                if (event.target.checked) {
                                                    table.primaryKey = Array.from(new Set([...table.primaryKey, column.name]));
                                                } else {
                                                    table.primaryKey = table.primaryKey.filter((key) => key !== column.name);
                                                }
                                                table.columns = table.columns.map((entry) => ({
                                                    ...entry,
                                                    isKey: table.primaryKey.includes(entry.name),
                                                }));
                                                return table;
                                            })}
                                        />
                                        Primary key
                                    </label>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => updateTable((table) => {
                                                if (index === 0) return table;
                                                [table.columns[index - 1], table.columns[index]] = [table.columns[index], table.columns[index - 1]];
                                                table.sampleData = (table.sampleData ?? []).map((row) => {
                                                    const nextRow = [...row];
                                                    [nextRow[index - 1], nextRow[index]] = [nextRow[index], nextRow[index - 1]];
                                                    return nextRow;
                                                });
                                                return table;
                                            })}
                                            disabled={index === 0}
                                            className="rounded border border-border bg-card p-1 text-muted-foreground disabled:opacity-40"
                                            title="Move up"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => updateTable((table) => {
                                                if (index >= table.columns.length - 1) return table;
                                                [table.columns[index + 1], table.columns[index]] = [table.columns[index], table.columns[index + 1]];
                                                table.sampleData = (table.sampleData ?? []).map((row) => {
                                                    const nextRow = [...row];
                                                    [nextRow[index + 1], nextRow[index]] = [nextRow[index], nextRow[index + 1]];
                                                    return nextRow;
                                                });
                                                return table;
                                            })}
                                            disabled={index >= inputTable.columns.length - 1}
                                            className="rounded border border-border bg-card p-1 text-muted-foreground disabled:opacity-40"
                                            title="Move down"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Sample data</p>
                        <button
                            onClick={() => updateTable((table) => {
                                const width = table.columns.length;
                                table.sampleData = [...(table.sampleData ?? []), Array.from({ length: width }, () => '')];
                                return table;
                            })}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Row
                        </button>
                    </div>

                    <div className="space-y-2">
                        <textarea
                            value={pasteBuffer}
                            onChange={(event) => setPasteBuffer(event.target.value)}
                            placeholder="Paste spreadsheet rows (tab or comma separated)"
                            className="min-h-16 w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground outline-none"
                        />
                        <button
                            onClick={() => {
                                const parsed = parsePastedGrid(pasteBuffer);
                                if (parsed.length === 0) return;
                                updateTable((table) => {
                                    const width = table.columns.length;
                                    table.sampleData = parsed.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
                                    return table;
                                });
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Apply pasted grid
                        </button>
                    </div>

                    <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/65">
                                    {inputTable.columns.map((column) => (
                                        <th key={column.name} className="border-b border-border px-2 py-1 text-left font-semibold text-muted-foreground">
                                            {column.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(inputTable.sampleData ?? []).map((row, rowIndex) => (
                                    <tr key={`row_${rowIndex}`}>
                                        {inputTable.columns.map((column, columnIndex) => {
                                            const value = row[columnIndex] ?? '';
                                            const multi = /[|;,]/.test(value);
                                            return (
                                                <td key={`cell_${rowIndex}_${column.name}`} className="border-b border-border/65 px-1 py-1">
                                                    <input
                                                        value={value}
                                                        onChange={(event) => updateTable((table) => {
                                                            table.sampleData = table.sampleData ?? [];
                                                            table.sampleData[rowIndex][columnIndex] = event.target.value;
                                                            return table;
                                                        })}
                                                        className="w-full rounded border px-1 py-1 text-[11px] text-foreground outline-none"
                                                        style={{
                                                            borderColor: multi
                                                                ? 'color-mix(in oklab, var(--warning) 50%, var(--border))'
                                                                : 'color-mix(in oklab, var(--border) 82%, transparent)',
                                                            background: multi
                                                                ? 'color-mix(in oklab, var(--warning) 12%, transparent)'
                                                                : 'color-mix(in oklab, var(--card) 86%, transparent)',
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Import from seed datasets</p>
                    <div className="space-y-2">
                        <select
                            value={selectedDatasetName}
                            onChange={(event) => {
                                setSelectedDatasetName(event.target.value);
                                setSelectedDatasetTable('');
                            }}
                            className="w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground outline-none"
                        >
                            <option value="">Select dataset…</option>
                            {datasets.map((dataset) => (
                                <option key={dataset.name} value={dataset.name}>
                                    {dataset.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedDatasetTable}
                            onChange={(event) => setSelectedDatasetTable(event.target.value)}
                            disabled={!selectedDataset}
                            className="w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground outline-none disabled:opacity-40"
                        >
                            <option value="">Select table…</option>
                            {selectedDatasetTables.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => {
                                if (!selectedDataset || !selectedDatasetTable) return;
                                const records = recordsFromDataset(selectedDataset, selectedDatasetTable);
                                if (records.length === 0) return;
                                setInputTable(buildNormalizerTableFromRecords(selectedDatasetTable, records));
                            }}
                            disabled={!selectedDataset || !selectedDatasetTable}
                            className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-40"
                        >
                            Load selected table
                        </button>
                    </div>
                </section>

                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Functional dependencies</p>
                        {!showFDs && (
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Hidden on canvas</span>
                        )}
                    </div>

                    <div className="mb-2 rounded-lg border border-border bg-muted/40 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Auto-inferred</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {autoInferredFDs.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground/80">No inferred FDs yet.</span>
                            ) : (
                                autoInferredFDs.map((fd, index) => (
                                    <span
                                        key={`auto_fd_${index}`}
                                        className="rounded-md border border-border/80 bg-card/80 px-2 py-1 text-[10px] text-muted-foreground"
                                    >
                                        {fd.determinant.join(', ')}{' -> '}{fd.dependent.join(', ')}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300">Manual FDs</p>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <select
                                multiple
                                value={determinantDraft}
                                onChange={(event) => setDeterminantDraft(Array.from(event.target.selectedOptions).map((option) => option.value))}
                                className="min-h-20 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none"
                            >
                                {inputTable.columns.map((column) => (
                                    <option key={`det_${column.name}`} value={column.name}>{column.name}</option>
                                ))}
                            </select>

                            <select
                                multiple
                                value={dependentDraft}
                                onChange={(event) => setDependentDraft(Array.from(event.target.selectedOptions).map((option) => option.value))}
                                className="min-h-20 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none"
                            >
                                {inputTable.columns.map((column) => (
                                    <option key={`dep_${column.name}`} value={column.name}>{column.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                const determinant = determinantDraft.filter((column) => !dependentDraft.includes(column));
                                const dependent = dependentDraft.filter((column) => !determinant.includes(column));
                                if (determinant.length === 0 || dependent.length === 0) return;

                                updateTable((table) => {
                                    table.fds = [...table.fds, { determinant, dependent }];
                                    return table;
                                });
                            }}
                            className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25"
                        >
                            Add manual FD
                        </button>

                        <div className="mt-2 space-y-1">
                            {inputTable.fds.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground">No manual FDs.</span>
                            ) : (
                                inputTable.fds.map((fd: FunctionalDependency, index: number) => (
                                    <div key={`manual_fd_${index}`} className="flex items-center justify-between rounded border border-border/80 bg-card/70 px-2 py-1 text-[11px]">
                                        <span className="text-foreground/90">{fd.determinant.join(', ')}{' -> '}{fd.dependent.join(', ')}</span>
                                        <button
                                            onClick={() => updateTable((table) => {
                                                table.fds = table.fds.filter((_, fdIndex) => fdIndex !== index);
                                                return table;
                                            })}
                                            className="rounded border border-rose-500/35 bg-rose-500/10 px-1 py-0.5 text-rose-300 hover:bg-rose-500/20"
                                        >
                                            remove
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
