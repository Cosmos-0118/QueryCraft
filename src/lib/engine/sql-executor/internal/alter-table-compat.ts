import type { QueryResult } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { stripComments } from '../utils';
import type { SqlJsDatabase } from '../types';

interface TableColumnMeta {
  name: string;
  definition: string;
}

interface RebuildColumnSpec {
  name: string;
  definition: string;
  sourceName?: string;
}

export interface AlterTableCompatibilityContext {
  getActiveDb(): SqlJsDatabase | null;
  getTableColumnMeta(tableName: string): TableColumnMeta[];
  normalizeAlterColumnDefinition(rawDefinition: string): string;
  normalizeIdentifier(raw: string): string;
  parseLeadingIdentifier(raw: string): { identifier: string; rest: string } | null;
  quoteIdentifier(identifier: string): string;
  rebuildTableWithSpec(
    tableName: string,
    columns: RebuildColumnSpec[],
    rawSql: string,
    startTime: number,
  ): QueryResult;
  replaceLeadingIdentifier(definition: string, nextName: string): string;
  splitTopLevelComma(raw: string): string[];
}

export function handleAlterTableCompatibility(
  this: AlterTableCompatibilityContext,
  rawSql: string,
  startTime: number,
): QueryResult | null {
  const cleaned = stripComments(rawSql).trim().replace(/;$/, '').trim();
  if (!/^ALTER\s+TABLE\b/i.test(cleaned)) return null;

  const afterAlterTable = cleaned.replace(/^ALTER\s+TABLE\s+/i, '');
  const tableParsed = this.parseLeadingIdentifier(afterAlterTable);
  if (!tableParsed) return null;

  let tableName = tableParsed.identifier;
  const operationSegment = tableParsed.rest.trim();
  const operations = this.splitTopLevelComma(operationSegment);
  if (operations.length === 0) return null;

  for (const operation of operations) {
    const columnsMeta = this.getTableColumnMeta(tableName);
    if (columnsMeta.length === 0) {
      return sqlErrorEngine.fromMessage(`Table '${tableName}' doesn't exist`, {
        sql: rawSql,
        startTime,
      });
    }

    const modifyMatch = operation.match(/^MODIFY(?:\s+COLUMN)?\s+([\s\S]+)$/i);
    if (modifyMatch) {
      const replacementDefinition = this.normalizeAlterColumnDefinition(modifyMatch[1].trim());
      const targetParsed = this.parseLeadingIdentifier(replacementDefinition);
      if (!targetParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE MODIFY syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const sourceLower = targetParsed.identifier.toLowerCase();
      if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
        return sqlErrorEngine.fromMessage(
          `Unknown column '${targetParsed.identifier}' in '${tableName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
        column.name.toLowerCase() === sourceLower
          ? {
              name: targetParsed.identifier,
              definition: replacementDefinition,
              sourceName: column.name,
            }
          : { name: column.name, definition: column.definition, sourceName: column.name },
      );

      const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
      if (result.error) return result;
      continue;
    }

    const changeMatch = operation.match(/^CHANGE(?:\s+COLUMN)?\s+([\s\S]+)$/i);
    if (changeMatch) {
      const sourceParsed = this.parseLeadingIdentifier(changeMatch[1].trim());
      if (!sourceParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE CHANGE syntax', {
          sql: rawSql,
          startTime,
        });
      }
      const replacementDefinition = this.normalizeAlterColumnDefinition(sourceParsed.rest.trim());
      const targetParsed = this.parseLeadingIdentifier(replacementDefinition);
      if (!targetParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE CHANGE target definition', {
          sql: rawSql,
          startTime,
        });
      }

      const sourceLower = sourceParsed.identifier.toLowerCase();
      if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
        return sqlErrorEngine.fromMessage(
          `Unknown column '${sourceParsed.identifier}' in '${tableName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
        column.name.toLowerCase() === sourceLower
          ? {
              name: targetParsed.identifier,
              definition: replacementDefinition,
              sourceName: column.name,
            }
          : { name: column.name, definition: column.definition, sourceName: column.name },
      );

      const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
      if (result.error) return result;
      continue;
    }

    const renameColumnMatch = operation.match(/^RENAME\s+COLUMN\s+(.+)\s+TO\s+(.+)$/i);
    if (renameColumnMatch) {
      const sourceParsed = this.parseLeadingIdentifier(renameColumnMatch[1]);
      const targetParsed = this.parseLeadingIdentifier(renameColumnMatch[2]);
      if (!sourceParsed || !targetParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE RENAME COLUMN syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const sourceLower = sourceParsed.identifier.toLowerCase();
      if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
        return sqlErrorEngine.fromMessage(
          `Unknown column '${sourceParsed.identifier}' in '${tableName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
        column.name.toLowerCase() === sourceLower
          ? {
              name: targetParsed.identifier,
              definition: this.replaceLeadingIdentifier(
                column.definition,
                targetParsed.identifier,
              ),
              sourceName: column.name,
            }
          : { name: column.name, definition: column.definition, sourceName: column.name },
      );

      const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
      if (result.error) return result;
      continue;
    }

    const dropColumnMatch = operation.match(/^DROP(?:\s+COLUMN)?\s+(?!INDEX\b)(?!KEY\b)(.+)$/i);
    if (dropColumnMatch) {
      const targetParsed = this.parseLeadingIdentifier(dropColumnMatch[1]);
      if (!targetParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE DROP COLUMN syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const targetLower = targetParsed.identifier.toLowerCase();
      const remaining = columnsMeta.filter((column) => column.name.toLowerCase() !== targetLower);
      if (remaining.length === columnsMeta.length) {
        return sqlErrorEngine.fromMessage(
          `Unknown column '${targetParsed.identifier}' in '${tableName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }
      if (remaining.length === 0) {
        return sqlErrorEngine.fromMessage('Cannot drop all columns from a table.', {
          sql: rawSql,
          startTime,
        });
      }

      const spec: RebuildColumnSpec[] = remaining.map((column) => ({
        name: column.name,
        definition: column.definition,
        sourceName: column.name,
      }));
      const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
      if (result.error) return result;
      continue;
    }

    const addColumnMatch = operation.match(
      /^ADD(?:\s+COLUMN)?\s+(?!UNIQUE\b)(?!INDEX\b)(?!KEY\b)(?!PRIMARY\b)(?!CONSTRAINT\b)([\s\S]+)$/i,
    );
    if (addColumnMatch) {
      let clauseBody = addColumnMatch[1].trim();
      let position: { first: boolean; after?: string } | null = null;

      const firstMatch = clauseBody.match(/\s+FIRST\s*$/i);
      if (firstMatch) {
        position = { first: true };
        clauseBody = clauseBody.slice(0, firstMatch.index).trim();
      } else {
        const afterMatch = clauseBody.match(/\s+AFTER\s+(.+)$/i);
        if (afterMatch && afterMatch.index !== undefined) {
          const parsedAfter = this.parseLeadingIdentifier(afterMatch[1]);
          if (!parsedAfter) {
            return sqlErrorEngine.fromMessage('Invalid ALTER TABLE ADD COLUMN AFTER syntax', {
              sql: rawSql,
              startTime,
            });
          }
          position = { first: false, after: parsedAfter.identifier };
          clauseBody = clauseBody.slice(0, afterMatch.index).trim();
        }
      }

      const normalizedDefinition = this.normalizeAlterColumnDefinition(clauseBody);
      const newParsed = this.parseLeadingIdentifier(normalizedDefinition);
      if (!newParsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE ADD COLUMN syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const exists = columnsMeta.some(
        (column) => column.name.toLowerCase() === newParsed.identifier.toLowerCase(),
      );
      if (exists) {
        return sqlErrorEngine.fromMessage(
          `Duplicate column name '${newParsed.identifier}' in '${tableName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const spec: RebuildColumnSpec[] = columnsMeta.map((column) => ({
        name: column.name,
        definition: column.definition,
        sourceName: column.name,
      }));

      const nextColumn: RebuildColumnSpec = {
        name: newParsed.identifier,
        definition: normalizedDefinition,
      };

      if (!position) {
        spec.push(nextColumn);
      } else if (position.first) {
        spec.unshift(nextColumn);
      } else {
        const afterIndex = spec.findIndex(
          (column) => column.name.toLowerCase() === (position.after ?? '').toLowerCase(),
        );
        if (afterIndex < 0) {
          return sqlErrorEngine.fromMessage(
            `Unknown column '${position.after}' in '${tableName}' for AFTER clause`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }
        spec.splice(afterIndex + 1, 0, nextColumn);
      }

      const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
      if (result.error) return result;
      continue;
    }

    const renameTableMatch = operation.match(/^RENAME\s+TO\s+(.+)$/i);
    if (renameTableMatch) {
      const nextTable = this.parseLeadingIdentifier(renameTableMatch[1]);
      if (!nextTable) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE RENAME TO syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const activeDb = this.getActiveDb();
      if (!activeDb) {
        return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
          sql: rawSql,
          startTime,
        });
      }

      try {
        activeDb.run(
          `ALTER TABLE ${this.quoteIdentifier(tableName)} RENAME TO ${this.quoteIdentifier(nextTable.identifier)}`,
        );
      } catch (error) {
        return sqlErrorEngine.fromUnknownError(error, {
          sql: rawSql,
          startTime,
        });
      }

      tableName = nextTable.identifier;
      continue;
    }

    const addIndexMatch = operation.match(
      /^ADD\s+(UNIQUE\s+)?(?:INDEX|KEY)\s+(?:([`"']?[A-Za-z_][\w$]*[`"']?)\s*)?\(([^)]+)\)$/i,
    );
    if (addIndexMatch) {
      const isUnique = Boolean(addIndexMatch[1]);
      const explicitName = addIndexMatch[2]
        ? this.normalizeIdentifier(addIndexMatch[2])
        : `${tableName}_${addIndexMatch[3].replace(/[^A-Za-z0-9_]+/g, '_')}_idx`;
      const columns = this.splitTopLevelComma(addIndexMatch[3]).map((part) => {
        const parsed = this.parseLeadingIdentifier(part.trim());
        return parsed ? this.quoteIdentifier(parsed.identifier) : part.trim();
      });
      const createIndexSql = `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.quoteIdentifier(explicitName)} ON ${this.quoteIdentifier(tableName)} (${columns.join(', ')})`;
      const activeDb = this.getActiveDb();
      if (!activeDb) {
        return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
          sql: rawSql,
          startTime,
        });
      }
      try {
        activeDb.run(createIndexSql);
      } catch (error) {
        return sqlErrorEngine.fromUnknownError(error, {
          sql: rawSql,
          startTime,
        });
      }
      continue;
    }

    const dropIndexMatch = operation.match(/^DROP\s+INDEX\s+(.+)$/i);
    if (dropIndexMatch) {
      const parsed = this.parseLeadingIdentifier(dropIndexMatch[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid ALTER TABLE DROP INDEX syntax', {
          sql: rawSql,
          startTime,
        });
      }

      const activeDb = this.getActiveDb();
      if (!activeDb) {
        return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
          sql: rawSql,
          startTime,
        });
      }
      try {
        activeDb.run(`DROP INDEX IF EXISTS ${this.quoteIdentifier(parsed.identifier)}`);
      } catch (error) {
        return sqlErrorEngine.fromUnknownError(error, {
          sql: rawSql,
          startTime,
        });
      }
      continue;
    }

    return sqlErrorEngine.fromMessage(
      `Unsupported ALTER TABLE operation segment: '${operation}'.`,
      {
        sql: rawSql,
        startTime,
      },
    );
  }

  return {
    columns: [],
    rows: [],
    rowCount: 0,
    executionTimeMs: performance.now() - startTime,
  };
}
