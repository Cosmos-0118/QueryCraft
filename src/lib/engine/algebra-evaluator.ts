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
