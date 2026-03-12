import type { AlgebraNode, AlgebraOperationType } from '@/types/algebra';

// ── Token types ──
type TokenType =
  | 'SIGMA'
  | 'PI'
  | 'JOIN'
  | 'NATURAL_JOIN'
  | 'UNION'
  | 'DIFFERENCE'
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
  ['σ', 'SIGMA'],
  ['sigma', 'SIGMA'],
  ['π', 'PI'],
  ['pi', 'PI'],
  ['project', 'PI'],
  ['⋈', 'NATURAL_JOIN'],
  ['JOIN', 'JOIN'],
  ['join', 'JOIN'],
  ['∪', 'UNION'],
  ['UNION', 'UNION'],
  ['union', 'UNION'],
  ['−', 'DIFFERENCE'],
  ['-', 'DIFFERENCE'],
  ['MINUS', 'DIFFERENCE'],
  ['minus', 'DIFFERENCE'],
  ['×', 'CARTESIAN'],
  ['CROSS', 'CARTESIAN'],
  ['cross', 'CARTESIAN'],
  ['ρ', 'RENAME'],
  ['rho', 'RENAME'],
  ['rename', 'RENAME'],
  ['←', 'ARROW'],
  ['<-', 'ARROW'],
];

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

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
    for (const [sym, type] of SYMBOLS) {
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
  DIFFERENCE: 'difference',
  CARTESIAN: 'cartesian',
  JOIN: 'theta_join',
  NATURAL_JOIN: 'natural_join',
};

const OP_LABELS: Record<string, string> = {
  UNION: '∪',
  DIFFERENCE: '−',
  CARTESIAN: '×',
  JOIN: '⋈θ',
  NATURAL_JOIN: '⋈',
};

function parseExpr(): AlgebraNode {
  let left = parseUnary();

  while (peek().type in BINARY_OPS) {
    const op = advance();
    let condition: string | undefined;
    if (op.type === 'JOIN' && (peek().type === 'LBRACKET' || peek().type === 'CONDITION')) {
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
    case 'difference':
      return `(${algebraToSQL(node.children[0])}) EXCEPT (${algebraToSQL(node.children[1])})`;
    case 'cartesian':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l, (${algebraToSQL(node.children[1])}) AS _r`;
    case 'natural_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l NATURAL JOIN (${algebraToSQL(node.children[1])}) AS _r`;
    case 'theta_join':
    case 'equi_join':
      return `SELECT * FROM (${algebraToSQL(node.children[0])}) AS _l JOIN (${algebraToSQL(node.children[1])}) AS _r ON ${node.condition}`;
    default:
      return '-- unsupported operation';
  }
}
