import type { AlgebraNode, AlgebraOperationType } from '@/types/algebra';

// ── Token types ──
type TokenType =
  | 'SIGMA'
  | 'PI'
  | 'GAMMA'
  | 'TAU'
  | 'JOIN'
  | 'NATURAL_JOIN'
  | 'LEFT_OUTER_JOIN'
  | 'RIGHT_OUTER_JOIN'
  | 'FULL_OUTER_JOIN'
  | 'SEMI_JOIN'
  | 'ANTI_JOIN'
  | 'UNION'
  | 'INTERSECTION'
  | 'DIFFERENCE'
  | 'DIVISION'
  | 'CARTESIAN'
  | 'RENAME'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'IDENT'
  | 'CONDITION'
  | 'ARROW'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ── Tokenizer ──
const SYMBOLS: [string, TokenType][] = [
  // Multi-char text keywords first (longest match)
  ['FULL OUTER JOIN', 'FULL_OUTER_JOIN'],
  ['full outer join', 'FULL_OUTER_JOIN'],
  ['LEFT OUTER JOIN', 'LEFT_OUTER_JOIN'],
  ['left outer join', 'LEFT_OUTER_JOIN'],
  ['RIGHT OUTER JOIN', 'RIGHT_OUTER_JOIN'],
  ['right outer join', 'RIGHT_OUTER_JOIN'],
  ['LEFT JOIN', 'LEFT_OUTER_JOIN'],
  ['left join', 'LEFT_OUTER_JOIN'],
  ['RIGHT JOIN', 'RIGHT_OUTER_JOIN'],
  ['right join', 'RIGHT_OUTER_JOIN'],
  ['FULL JOIN', 'FULL_OUTER_JOIN'],
  ['full join', 'FULL_OUTER_JOIN'],
  ['SEMIJOIN', 'SEMI_JOIN'],
  ['semijoin', 'SEMI_JOIN'],
  ['SEMI JOIN', 'SEMI_JOIN'],
  ['semi join', 'SEMI_JOIN'],
  ['ANTIJOIN', 'ANTI_JOIN'],
  ['antijoin', 'ANTI_JOIN'],
  ['ANTI JOIN', 'ANTI_JOIN'],
  ['anti join', 'ANTI_JOIN'],
  // Unicode symbols
  ['σ', 'SIGMA'],
  ['π', 'PI'],
  ['γ', 'GAMMA'],
  ['τ', 'TAU'],
  ['⋈', 'NATURAL_JOIN'],
  ['⟕', 'LEFT_OUTER_JOIN'],
  ['⟖', 'RIGHT_OUTER_JOIN'],
  ['⟗', 'FULL_OUTER_JOIN'],
  ['⋉', 'SEMI_JOIN'],
  ['▷', 'ANTI_JOIN'],
  ['⊳', 'ANTI_JOIN'],
  ['∪', 'UNION'],
  ['∩', 'INTERSECTION'],
  ['−', 'DIFFERENCE'],
  ['÷', 'DIVISION'],
  ['×', 'CARTESIAN'],
  ['ρ', 'RENAME'],
  ['←', 'ARROW'],
  ['<-', 'ARROW'],
  // Text aliases
  ['sigma', 'SIGMA'],
  ['select', 'SIGMA'],
  ['pi', 'PI'],
  ['project', 'PI'],
  ['gamma', 'GAMMA'],
  ['agg', 'GAMMA'],
  ['aggregate', 'GAMMA'],
  ['tau', 'TAU'],
  ['sort', 'TAU'],
  ['orderby', 'TAU'],
  ['JOIN', 'JOIN'],
  ['join', 'JOIN'],
  ['NJOIN', 'NATURAL_JOIN'],
  ['njoin', 'NATURAL_JOIN'],
  ['LJOIN', 'LEFT_OUTER_JOIN'],
  ['ljoin', 'LEFT_OUTER_JOIN'],
  ['RJOIN', 'RIGHT_OUTER_JOIN'],
  ['rjoin', 'RIGHT_OUTER_JOIN'],
  ['FJOIN', 'FULL_OUTER_JOIN'],
  ['fjoin', 'FULL_OUTER_JOIN'],
  ['UNION', 'UNION'],
  ['union', 'UNION'],
  ['INTERSECT', 'INTERSECTION'],
  ['intersect', 'INTERSECTION'],
  ['MINUS', 'DIFFERENCE'],
  ['minus', 'DIFFERENCE'],
  ['DIFF', 'DIFFERENCE'],
  ['diff', 'DIFFERENCE'],
  ['DIV', 'DIVISION'],
  ['div', 'DIVISION'],
  ['CROSS', 'CARTESIAN'],
  ['cross', 'CARTESIAN'],
  ['rho', 'RENAME'],
  ['rename', 'RENAME'],
  ['-', 'DIFFERENCE'],
];

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  // Sort symbols by length descending for longest-match-first
  const sortedSymbols = [...SYMBOLS].sort((a, b) => b[0].length - a[0].length);

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // Brackets
    if (input[i] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (input[i] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }
    if (input[i] === '[') {
      tokens.push({ type: 'LBRACKET', value: '[', pos: i });
      i++;
      continue;
    }
    if (input[i] === ']') {
      tokens.push({ type: 'RBRACKET', value: ']', pos: i });
      i++;
      continue;
    }
    if (input[i] === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i });
      i++;
      continue;
    }

    // Try matching symbols (longest first)
    let matched = false;
    for (const [sym, type] of sortedSymbols) {
      if (input.slice(i, i + sym.length) === sym) {
        // Ensure word-boundary for alphabetic symbols
        if (
          /[a-zA-Z]/.test(sym[0]) &&
          i + sym.length < input.length &&
          /[a-zA-Z0-9_]/.test(input[i + sym.length])
        ) {
          continue;
        }
        tokens.push({ type, value: sym, pos: i });
        i += sym.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Condition in subscript: { ... }
    if (input[i] === '{') {
      const start = i;
      i++; // skip {
      let depth = 1;
      while (i < input.length && depth > 0) {
        if (input[i] === '{') depth++;
        if (input[i] === '}') depth--;
        i++;
      }
      tokens.push({ type: 'CONDITION', value: input.slice(start + 1, i - 1), pos: start });
      continue;
    }

    // Identifier (table or column name)
    if (/[a-zA-Z_]/.test(input[i])) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_.*]/.test(input[i])) i++;
      tokens.push({ type: 'IDENT', value: input.slice(start, i), pos: start });
      continue;
    }

    // Skip unknown characters
    i++;
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ── Parser ──
// Grammar (simplified):
// expr      → unaryExpr ((UNION | DIFFERENCE | CARTESIAN | JOIN | NATURAL_JOIN) unaryExpr)*
// unaryExpr → SIGMA LBRACKET condition RBRACKET LPAREN expr RPAREN
//           | PI LBRACKET columns RBRACKET LPAREN expr RPAREN
//           | RENAME LBRACKET newName RBRACKET LPAREN expr RPAREN
//           | LPAREN expr RPAREN
//           | IDENT (relation)

let pos = 0;
let toks: Token[] = [];

function peek(): Token {
  return toks[pos] ?? toks[toks.length - 1];
}
function advance(): Token {
  return toks[pos++];
}
function expect(type: TokenType): Token {
  const t = advance();
  if (t.type !== type)
    throw new Error(`Expected ${type} but got ${t.type} ("${t.value}") at position ${t.pos}`);
  return t;
}

let nodeId = 0;
function nextId(): string {
  return `n${nodeId++}`;
}

function parseConditionArg(): string {
  // Accept [condition], {condition}, or bare CONDITION token
  if (peek().type === 'LBRACKET') {
    advance(); // [
    let cond = '';
    while (peek().type !== 'RBRACKET' && peek().type !== 'EOF') {
      cond += (cond ? ' ' : '') + advance().value;
    }
    expect('RBRACKET');
    return cond;
  }
  if (peek().type === 'CONDITION') {
    return advance().value;
  }
  // Try bare ident as condition
  return advance().value;
}

function parseColumnList(): string[] {
  if (peek().type === 'LBRACKET') {
    advance(); // [
    const cols: string[] = [];
    while (peek().type !== 'RBRACKET' && peek().type !== 'EOF') {
      if (peek().type === 'COMMA') {
        advance();
        continue;
      }
      cols.push(advance().value);
    }
    expect('RBRACKET');
    return cols;
  }
  if (peek().type === 'CONDITION') {
    return advance()
      .value.split(',')
      .map((s) => s.trim());
  }
  return [advance().value];
}

function parseUnary(): AlgebraNode {
  const t = peek();

  if (t.type === 'SIGMA') {
    advance();
    const cond = parseConditionArg();
    expect('LPAREN');
    const child = parseExpr();
    expect('RPAREN');
    return {
      id: nextId(),
      operation: 'selection',
      label: `σ[${cond}]`,
      condition: cond,
      children: [child],
    };
  }

  if (t.type === 'PI') {
    advance();
    const cols = parseColumnList();
    expect('LPAREN');
    const child = parseExpr();
    expect('RPAREN');
    return {
      id: nextId(),
      operation: 'projection',
      label: `π[${cols.join(',')}]`,
      columns: cols,
      children: [child],
    };
  }

  if (t.type === 'RENAME') {
    advance();
    const newName = parseConditionArg();
    expect('LPAREN');
    const child = parseExpr();
    expect('RPAREN');
    return {
      id: nextId(),
      operation: 'rename',
      label: `ρ[${newName}]`,
      newName,
      children: [child],
    };
  }

  // γ[groupCols; aggFunc(col) AS alias, ...](R)
  if (t.type === 'GAMMA') {
    advance();
    const spec = parseConditionArg(); // read everything inside [...]
    const parts = spec.split(';').map((s) => s.trim());
    const groupColumns = parts[0]
      ? parts[0].split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const aggregates: { func: string; col: string; alias: string }[] = [];
    if (parts[1]) {
      const aggParts = parts[1].split(',').map((s) => s.trim());
      for (const ap of aggParts) {
        // e.g. SUM(amount) AS total  or  COUNT(*)
        const m = ap.match(/^(\w+)\(([^)]*)\)(?:\s+[Aa][Ss]\s+(\w+))?$/);
        if (m) {
          const func = m[1].toUpperCase();
          const col = m[2].trim() || '*';
          const alias = m[3] || `${func}_${col}`.replace('*', 'all');
          aggregates.push({ func, col, alias });
        }
      }
    }
    expect('LPAREN');
    const child = parseExpr();
    expect('RPAREN');
    const label = `γ[${groupColumns.join(',')}; ${aggregates.map((a) => `${a.func}(${a.col})`).join(',')}]`;
    return {
      id: nextId(),
      operation: 'aggregation',
      label,
      groupColumns,
      aggregates,
      children: [child],
    };
  }

  // τ[col ASC, col2 DESC](R)
  if (t.type === 'TAU') {
    advance();
    const spec = parseConditionArg();
    const sortColumns: { col: string; dir: 'ASC' | 'DESC' }[] = spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const parts = s.split(/\s+/);
        const col = parts[0];
        const dir = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' as const : 'ASC' as const;
        return { col, dir };
      });
    expect('LPAREN');
    const child = parseExpr();
    expect('RPAREN');
    return {
      id: nextId(),
      operation: 'sort',
      label: `τ[${sortColumns.map((s) => `${s.col} ${s.dir}`).join(',')}]`,
      sortColumns,
      children: [child],
    };
  }

  if (t.type === 'LPAREN') {
    advance();
    const inner = parseExpr();
    expect('RPAREN');
    return inner;
  }

  if (t.type === 'IDENT') {
    const name = advance().value;
    return {
      id: nextId(),
      operation: 'relation',
      label: name,
      relationName: name,
      children: [],
    };
  }

  throw new Error(`Unexpected token "${t.value}" at position ${t.pos}`);
}

const BINARY_OPS: Record<string, AlgebraOperationType> = {
  UNION: 'union',
  INTERSECTION: 'intersection',
  DIFFERENCE: 'difference',
  DIVISION: 'division',
  CARTESIAN: 'cartesian',
  JOIN: 'theta_join',
  NATURAL_JOIN: 'natural_join',
  LEFT_OUTER_JOIN: 'left_outer_join',
  RIGHT_OUTER_JOIN: 'right_outer_join',
  FULL_OUTER_JOIN: 'full_outer_join',
  SEMI_JOIN: 'semi_join',
  ANTI_JOIN: 'anti_join',
};

const OP_LABELS: Record<string, string> = {
  UNION: '∪',
  INTERSECTION: '∩',
  DIFFERENCE: '−',
  DIVISION: '÷',
  CARTESIAN: '×',
  JOIN: '⋈θ',
  NATURAL_JOIN: '⋈',
  LEFT_OUTER_JOIN: '⟕',
  RIGHT_OUTER_JOIN: '⟖',
  FULL_OUTER_JOIN: '⟗',
  SEMI_JOIN: '⋉',
  ANTI_JOIN: '▷',
};

function parseExpr(): AlgebraNode {
  let left = parseUnary();

  while (peek().type in BINARY_OPS) {
    const op = advance();
    let condition: string | undefined;
    // Joins can have an optional condition in brackets
    if (
      (op.type === 'JOIN' || op.type === 'LEFT_OUTER_JOIN' || op.type === 'RIGHT_OUTER_JOIN' ||
       op.type === 'FULL_OUTER_JOIN' || op.type === 'SEMI_JOIN' || op.type === 'ANTI_JOIN') &&
      (peek().type === 'LBRACKET' || peek().type === 'CONDITION')
    ) {
      condition = parseConditionArg();
    }
    const right = parseUnary();
    left = {
      id: nextId(),
      operation: BINARY_OPS[op.type],
      label: OP_LABELS[op.type] + (condition ? `[${condition}]` : ''),
      condition,
      children: [left, right],
    };
  }
  return left;
}

export function parse(input: string): AlgebraNode {
  nodeId = 0;
  toks = tokenize(input);
  pos = 0;
  const tree = parseExpr();
  if (peek().type !== 'EOF') {
    throw new Error(`Unexpected token "${peek().value}" at position ${peek().pos}`);
  }
  return tree;
}

// ── Algebra → SQL converter ──
export function algebraToSQL(node: AlgebraNode): string {
  switch (node.operation) {
    case 'relation':
      return `SELECT * FROM "${node.relationName}"`;
    case 'selection':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _t WHERE ${node.condition}`;
    case 'projection':
      return `SELECT ${node.columns?.map((c) => `"${c}"`).join(', ')} FROM (${algebraToSQL(node.children[0])}) AS _t`;
    case 'rename':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS "${node.newName}"`;
    case 'union':
      return `(${algebraToSQL(node.children[0])}) UNION (${algebraToSQL(node.children[1])})`;
    case 'intersection':
      return `(${algebraToSQL(node.children[0])}) INTERSECT (${algebraToSQL(node.children[1])})`;
    case 'difference':
      return `(${algebraToSQL(node.children[0])}) EXCEPT (${algebraToSQL(node.children[1])})`;
    case 'cartesian':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l, (${algebraToSQL(node.children[1])}) AS _r`;
    case 'natural_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l NATURAL JOIN (${algebraToSQL(node.children[1])}) AS _r`;
    case 'left_outer_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l LEFT JOIN (${algebraToSQL(node.children[1])}) AS _r${node.condition ? ` ON ${node.condition}` : ''}`;
    case 'right_outer_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l RIGHT JOIN (${algebraToSQL(node.children[1])}) AS _r${node.condition ? ` ON ${node.condition}` : ''}`;
    case 'full_outer_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l FULL OUTER JOIN (${algebraToSQL(node.children[1])}) AS _r${node.condition ? ` ON ${node.condition}` : ''}`;
    case 'semi_join':
      return `SELECT _l.* FROM (${algebraToSQL(node.children[0])}) AS _l WHERE EXISTS (SELECT 1 FROM (${algebraToSQL(node.children[1])}) AS _r WHERE ${node.condition ?? '1=1'})`;
    case 'anti_join':
      return `SELECT _l.* FROM (${algebraToSQL(node.children[0])}) AS _l WHERE NOT EXISTS (SELECT 1 FROM (${algebraToSQL(node.children[1])}) AS _r WHERE ${node.condition ?? '1=1'})`;
    case 'division': {
      // R ÷ S = π[R\S](R) − π[R\S]((π[R\S](R) × S) − R)
      return `-- Division: R ÷ S\n(${algebraToSQL(node.children[0])}) EXCEPT (${algebraToSQL(node.children[1])})`;
    }
    case 'theta_join':
    case 'equi_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l JOIN (${algebraToSQL(node.children[1])}) AS _r ON ${node.condition}`;
    case 'aggregation': {
      const groupCols = node.groupColumns?.join(', ') || '';
      const aggExprs = node.aggregates?.map((a) => `${a.func}(${a.col === '*' ? '*' : `"${a.col}"`}) AS "${a.alias}"`).join(', ') || '';
      const selectCols = [groupCols, aggExprs].filter(Boolean).join(', ');
      const groupBy = groupCols ? ` GROUP BY ${groupCols}` : '';
      return `SELECT ${selectCols} FROM (${algebraToSQL(node.children[0])}) AS _t${groupBy}`;
    }
    case 'sort': {
      const orderCols = node.sortColumns?.map((s) => `"${s.col}" ${s.dir}`).join(', ') || '';
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _t ORDER BY ${orderCols}`;
    }
    default:
      return '-- unsupported operation';
  }
}
