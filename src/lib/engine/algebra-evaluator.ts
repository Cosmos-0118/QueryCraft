import type { AlgebraNode } from '@/types/algebra';
import type { Row, QueryResult } from '@/types/database';

export interface AlgebraContext {
  tables: Record<string, { columns: string[]; rows: Row[] }>;
}

export interface EvalResult {
  columns: string[];
  rows: Row[];
}

export interface StepResult {
  node: AlgebraNode;
  result: EvalResult;
}

export function evaluateAlgebra(
  node: AlgebraNode,
  ctx: AlgebraContext,
  steps: StepResult[] = [],
): EvalResult {
  let result: EvalResult;

  switch (node.operation) {
    case 'relation': {
      const table = ctx.tables[node.relationName ?? ''];
      if (!table) throw new Error(`Table "${node.relationName}" not found`);
      result = { columns: [...table.columns], rows: table.rows.map((r) => ({ ...r })) };
      break;
    }

    case 'selection': {
      const child = evaluateAlgebra(node.children[0], ctx, steps);
      const cond = node.condition ?? 'true';
      const filtered = child.rows.filter((row) => evalCondition(cond, row));
      result = { columns: child.columns, rows: filtered };
      break;
    }

    case 'projection': {
      const child = evaluateAlgebra(node.children[0], ctx, steps);
      const cols = node.columns ?? [];
      const projected = child.rows.map((row) => {
        const newRow: Row = {};
        cols.forEach((c) => {
          newRow[c] = row[c];
        });
        return newRow;
      });
      // Remove duplicates
      const seen = new Set<string>();
      const unique = projected.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      result = { columns: cols, rows: unique };
      break;
    }

    case 'rename': {
      const child = evaluateAlgebra(node.children[0], ctx, steps);
      result = { columns: child.columns, rows: child.rows };
      break;
    }

    case 'union': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const all = [...left.rows, ...right.rows];
      const seen = new Set<string>();
      const unique = all.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      result = { columns: left.columns, rows: unique };
      break;
    }

    case 'difference': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const rightKeys = new Set(right.rows.map((r) => JSON.stringify(r)));
      result = {
        columns: left.columns,
        rows: left.rows.filter((r) => !rightKeys.has(JSON.stringify(r))),
      };
      break;
    }

    case 'cartesian': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const cols = [...left.columns, ...right.columns.filter((c) => !left.columns.includes(c))];
      const rows: Row[] = [];
      for (const lr of left.rows) {
        for (const rr of right.rows) {
          rows.push({ ...lr, ...rr });
        }
      }
      result = { columns: cols, rows };
      break;
    }

    case 'natural_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = left.columns.filter((c) => right.columns.includes(c));
      const allCols = [...left.columns, ...right.columns.filter((c) => !common.includes(c))];
      const rows: Row[] = [];
      for (const lr of left.rows) {
        for (const rr of right.rows) {
          if (common.every((c) => lr[c] === rr[c])) {
            rows.push({ ...lr, ...rr });
          }
        }
      }
      result = { columns: allCols, rows };
      break;
    }

    case 'theta_join':
    case 'equi_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const cols = [...left.columns, ...right.columns.filter((c) => !left.columns.includes(c))];
      const cond = node.condition ?? 'true';
      const rows: Row[] = [];
      for (const lr of left.rows) {
        for (const rr of right.rows) {
          const merged = { ...lr, ...rr };
          if (evalCondition(cond, merged)) rows.push(merged);
        }
      }
      result = { columns: cols, rows };
      break;
    }

    case 'intersection': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const rightKeys = new Set(right.rows.map((r) => JSON.stringify(r)));
      result = {
        columns: left.columns,
        rows: left.rows.filter((r) => rightKeys.has(JSON.stringify(r))),
      };
      break;
    }

    case 'left_outer_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = node.condition ? [] : left.columns.filter((c) => right.columns.includes(c));
      const allCols = [...left.columns, ...right.columns.filter((c) => !left.columns.includes(c))];
      const rows: Row[] = [];
      for (const lr of left.rows) {
        let matched = false;
        for (const rr of right.rows) {
          const merged = { ...lr, ...rr };
          const condOk = node.condition
            ? evalCondition(node.condition, merged)
            : common.every((c) => lr[c] === rr[c]);
          if (condOk) {
            rows.push(merged);
            matched = true;
          }
        }
        if (!matched) {
          const nullRow: Row = { ...lr };
          for (const c of right.columns) {
            if (!(c in nullRow)) nullRow[c] = null;
          }
          rows.push(nullRow);
        }
      }
      result = { columns: allCols, rows };
      break;
    }

    case 'right_outer_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = node.condition ? [] : left.columns.filter((c) => right.columns.includes(c));
      const allCols = [...left.columns, ...right.columns.filter((c) => !left.columns.includes(c))];
      const rows: Row[] = [];
      for (const rr of right.rows) {
        let matched = false;
        for (const lr of left.rows) {
          const merged = { ...lr, ...rr };
          const condOk = node.condition
            ? evalCondition(node.condition, merged)
            : common.every((c) => lr[c] === rr[c]);
          if (condOk) {
            rows.push(merged);
            matched = true;
          }
        }
        if (!matched) {
          const nullRow: Row = { ...rr };
          for (const c of left.columns) {
            if (!(c in nullRow)) nullRow[c] = null;
          }
          rows.push(nullRow);
        }
      }
      result = { columns: allCols, rows };
      break;
    }

    case 'full_outer_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = node.condition ? [] : left.columns.filter((c) => right.columns.includes(c));
      const allCols = [...left.columns, ...right.columns.filter((c) => !left.columns.includes(c))];
      const rows: Row[] = [];
      const matchedRight = new Set<number>();
      for (const lr of left.rows) {
        let matched = false;
        for (let ri = 0; ri < right.rows.length; ri++) {
          const rr = right.rows[ri];
          const merged = { ...lr, ...rr };
          const condOk = node.condition
            ? evalCondition(node.condition, merged)
            : common.every((c) => lr[c] === rr[c]);
          if (condOk) {
            rows.push(merged);
            matched = true;
            matchedRight.add(ri);
          }
        }
        if (!matched) {
          const nullRow: Row = { ...lr };
          for (const c of right.columns) {
            if (!(c in nullRow)) nullRow[c] = null;
          }
          rows.push(nullRow);
        }
      }
      for (let ri = 0; ri < right.rows.length; ri++) {
        if (!matchedRight.has(ri)) {
          const nullRow: Row = { ...right.rows[ri] };
          for (const c of left.columns) {
            if (!(c in nullRow)) nullRow[c] = null;
          }
          rows.push(nullRow);
        }
      }
      result = { columns: allCols, rows };
      break;
    }

    case 'semi_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = node.condition ? [] : left.columns.filter((c) => right.columns.includes(c));
      const rows = left.rows.filter((lr) =>
        right.rows.some((rr) => {
          const merged = { ...lr, ...rr };
          return node.condition
            ? evalCondition(node.condition, merged)
            : common.every((c) => lr[c] === rr[c]);
        }),
      );
      result = { columns: left.columns, rows };
      break;
    }

    case 'anti_join': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      const common = node.condition ? [] : left.columns.filter((c) => right.columns.includes(c));
      const rows = left.rows.filter(
        (lr) =>
          !right.rows.some((rr) => {
            const merged = { ...lr, ...rr };
            return node.condition
              ? evalCondition(node.condition, merged)
              : common.every((c) => lr[c] === rr[c]);
          }),
      );
      result = { columns: left.columns, rows };
      break;
    }

    case 'division': {
      const left = evaluateAlgebra(node.children[0], ctx, steps);
      const right = evaluateAlgebra(node.children[1], ctx, steps);
      // R ÷ S: find tuples in R whose projection onto S-cols matches ALL tuples in S
      const sCols = right.columns;
      const rOnlyCols = left.columns.filter((c) => !sCols.includes(c));
      if (rOnlyCols.length === 0) throw new Error('Division requires R to have columns not in S');
      const rows: Row[] = [];
      // Group R rows by rOnlyCols
      const groups = new Map<string, Row[]>();
      for (const lr of left.rows) {
        const key = JSON.stringify(rOnlyCols.map((c) => lr[c]));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(lr);
      }
      for (const [, groupRows] of groups) {
        // Check if this group contains ALL of S
        const hasAll = right.rows.every((sr) =>
          groupRows.some((gr) => sCols.every((c) => gr[c] === sr[c])),
        );
        if (hasAll) {
          const row: Row = {};
          rOnlyCols.forEach((c) => {
            row[c] = groupRows[0][c];
          });
          rows.push(row);
        }
      }
      result = { columns: rOnlyCols, rows };
      break;
    }

    case 'aggregation': {
      const child = evaluateAlgebra(node.children[0], ctx, steps);
      const groupCols = node.groupColumns ?? [];
      const aggs = node.aggregates ?? [];
      const outCols = [...groupCols, ...aggs.map((a) => a.alias)];

      // Group rows
      const groups = new Map<string, Row[]>();
      for (const row of child.rows) {
        const key = groupCols.length > 0 ? JSON.stringify(groupCols.map((c) => row[c])) : '__all__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      const rows: Row[] = [];
      for (const [, groupRows] of groups) {
        const row: Row = {};
        groupCols.forEach((c) => {
          row[c] = groupRows[0][c];
        });
        for (const agg of aggs) {
          const vals =
            agg.col === '*'
              ? groupRows
              : groupRows.map((r) => r[agg.col]).filter((v) => v !== null && v !== undefined);
          switch (agg.func) {
            case 'COUNT':
              row[agg.alias] = agg.col === '*' ? groupRows.length : vals.length;
              break;
            case 'SUM':
              row[agg.alias] = (vals as number[]).reduce((a, b) => Number(a) + Number(b), 0);
              break;
            case 'AVG': {
              const numVals = vals as number[];
              row[agg.alias] =
                numVals.length > 0
                  ? Number(
                      (numVals.reduce((a, b) => Number(a) + Number(b), 0) / numVals.length).toFixed(
                        2,
                      ),
                    )
                  : null;
              break;
            }
            case 'MIN':
              row[agg.alias] =
                vals.length > 0
                  ? (vals as number[]).reduce((a, b) => (Number(a) < Number(b) ? a : b))
                  : null;
              break;
            case 'MAX':
              row[agg.alias] =
                vals.length > 0
                  ? (vals as number[]).reduce((a, b) => (Number(a) > Number(b) ? a : b))
                  : null;
              break;
            default:
              row[agg.alias] = null;
          }
        }
        rows.push(row);
      }
      result = { columns: outCols, rows };
      break;
    }

    case 'sort': {
      const child = evaluateAlgebra(node.children[0], ctx, steps);
      const sortCols = node.sortColumns ?? [];
      const sorted = [...child.rows].sort((a, b) => {
        for (const { col, dir } of sortCols) {
          const av = a[col];
          const bv = b[col];
          if (av === bv) continue;
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av ?? '').localeCompare(String(bv ?? ''));
          return dir === 'DESC' ? -cmp : cmp;
        }
        return 0;
      });
      result = { columns: child.columns, rows: sorted };
      break;
    }

    default:
      throw new Error(`Unsupported operation: ${node.operation}`);
  }

  steps.push({
    node,
    result: { columns: [...result.columns], rows: result.rows.map((r) => ({ ...r })) },
  });
  return result;
}

// Simple condition evaluator supporting: =, !=, <, >, <=, >=, AND, OR
function evalCondition(cond: string, row: Row): boolean {
  // Replace column references with values
  const expr = cond;

  // Handle AND/OR
  if (/\bAND\b/i.test(expr)) {
    const parts = expr.split(/\bAND\b/i);
    return parts.every((p) => evalCondition(p.trim(), row));
  }
  if (/\bOR\b/i.test(expr)) {
    const parts = expr.split(/\bOR\b/i);
    return parts.some((p) => evalCondition(p.trim(), row));
  }

  // Parse comparison: left op right
  const match = expr.match(/^(.+?)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) return true;

  const [, leftStr, op, rightStr] = match;
  const leftVal = resolveValue(leftStr.trim(), row);
  const rightVal = resolveValue(rightStr.trim(), row);

  switch (op) {
    case '=':
      return leftVal == rightVal; // intentional loose equality for number/string
    case '!=':
      return leftVal != rightVal;
    case '>':
      return Number(leftVal) > Number(rightVal);
    case '<':
      return Number(leftVal) < Number(rightVal);
    case '>=':
      return Number(leftVal) >= Number(rightVal);
    case '<=':
      return Number(leftVal) <= Number(rightVal);
    default:
      return true;
  }
}

function resolveValue(token: string, row: Row): unknown {
  // String literal
  if (
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
  ) {
    return token.slice(1, -1);
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  // Column reference
  if (token in row) return row[token];
  return token;
}

// Helper to build context from QueryResult data
export function buildContext(tableData: Record<string, QueryResult>): AlgebraContext {
  const tables: AlgebraContext['tables'] = {};
  for (const [name, qr] of Object.entries(tableData)) {
    tables[name] = { columns: qr.columns, rows: qr.rows };
  }
  return { tables };
}
