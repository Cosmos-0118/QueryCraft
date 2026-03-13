export interface ParsedTupleCalculus {
  target: string;
  formula: string;
}

function normalizeQuantifierAliases(input: string): string {
  return input
    .replace(/\bEXISTS\b/gi, '∃')
    .replace(/\bFORALL\b/gi, '∀')
    .replace(/(^|[\s{(|])3\s*([a-zA-Z_]\w*)/g, '$1∃$2');
}

function normalizeLogicalOperators(input: string): string {
  return input
    .replace(/\bAND\b/gi, ' AND ')
    .replace(/\bOR\b/gi, ' OR ')
    .replace(/\bNOT\b/gi, ' NOT ')
    .replace(/&&/g, ' AND ')
    .replace(/\|\|/g, ' OR ')
    .replace(/\s\^\s/g, ' AND ')
    .replace(/\s!\s/g, ' NOT ')
    .replace(/∧/g, ' AND ')
    .replace(/∨/g, ' OR ')
    .replace(/¬/g, ' NOT ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteAttributeRefs(input: string): string {
  return input.replace(/\b([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\b/g, '"$1"."$2"');
}

function normalizeTextbookNotation(input: string): string {
  return input
    .replace(/[∣]/g, '|')
    .replace(/[−]/g, '-')
    .replace(/\b([a-zA-Z_]\w*)\s*\[\s*([a-zA-Z_]\w*)\s*\]/g, '$1.$2')
    .replace(
      /([∃∀])\s*([a-zA-Z_]\w*)\s*(?:∈|\bE\b|\bin\b)\s*([a-zA-Z_]\w*)\s*\(/g,
      '$1$2 ($3($2) AND ',
    )
    .replace(/\b([a-zA-Z_]\w*)\s*(?:∈|\bE\b|\bin\b)\s*([a-zA-Z_]\w*)\b/g, '$2($1)');
}

function findMatchingParen(input: string, openParenIndex: number): number {
  let depth = 0;
  for (let i = openParenIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function inferMainRelation(formula: string, mainVariable: string): string | null {
  const direct = findRelationForVariable(formula, mainVariable);
  if (direct) return direct;

  const leftEq = formula.match(
    new RegExp(`\\b${mainVariable}\\.\\w+\\s*=\\s*([a-zA-Z_]\\w*)\\.\\w+`),
  );
  if (leftEq) {
    const relation = findRelationForVariable(formula, leftEq[1]);
    if (relation) return relation;
  }

  const rightEq = formula.match(
    new RegExp(`\\b([a-zA-Z_]\\w*)\\.\\w+\\s*=\\s*${mainVariable}\\.\\w+`),
  );
  if (rightEq) {
    const relation = findRelationForVariable(formula, rightEq[1]);
    if (relation) return relation;
  }

  return null;
}

function cleanupBooleanExpr(input: string): string {
  return input
    .replace(/\(\s*1\s*=\s*1\s*\)/g, '1 = 1')
    .replace(/\b1\s*=\s*1\s+AND\s+/gi, '')
    .replace(/\s+AND\s+1\s*=\s*1\b/gi, '')
    .replace(/\bWHERE\s+AND\b/gi, 'WHERE')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSetExpression(input: string): ParsedTupleCalculus {
  const trimmed = input.trim();
  const match = trimmed.match(/^\{\s*([\s\S]+?)\s*\|\s*([\s\S]+)\s*\}$/);
  if (!match) {
    throw new Error('Invalid TRC syntax. Expected { target | formula }.');
  }

  return {
    target: match[1].trim(),
    formula: match[2].trim(),
  };
}

function findRelationForVariable(formula: string, variable: string): string | null {
  const relationMatch = formula.match(
    new RegExp(`\\b([a-zA-Z_]\\w*)\\s*\\(\\s*${variable}\\s*\\)`),
  );
  return relationMatch ? relationMatch[1] : null;
}

function convertQuantifiers(formula: string): string {
  let current = formula;
  let guard = 0;

  while (current.includes('∃') || current.includes('∀')) {
    guard++;
    if (guard > 100) {
      throw new Error('TRC quantifier parsing exceeded safe depth.');
    }

    const quantifierStarts: number[] = [];
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '∃' || current[i] === '∀') {
        quantifierStarts.push(i);
      }
    }

    let replaced = false;

    for (let qi = quantifierStarts.length - 1; qi >= 0; qi--) {
      const start = quantifierStarts[qi];
      const quantifier = current[start];

      let i = start + 1;
      while (i < current.length && /\s/.test(current[i])) i++;

      const varStart = i;
      while (i < current.length && /[a-zA-Z0-9_]/.test(current[i])) i++;
      const variable = current.slice(varStart, i);
      if (!variable) continue;

      while (i < current.length && /\s/.test(current[i])) i++;
      if (current[i] !== '(') continue;

      const end = findMatchingParen(current, i);
      if (end < 0) {
        throw new Error(`Unclosed quantifier body for variable '${variable}'.`);
      }

      const body = current.slice(i + 1, end);
      if (body.includes('∃') || body.includes('∀')) {
        continue;
      }

      const relation = findRelationForVariable(body, variable);
      if (!relation) {
        throw new Error(`Missing relation predicate for quantified variable '${variable}'.`);
      }

      let inner = body.replace(
        new RegExp(`\\b${relation}\\s*\\(\\s*${variable}\\s*\\)`, 'g'),
        '1 = 1',
      );
      inner = normalizeLogicalOperators(inner);
      inner = quoteAttributeRefs(inner);
      inner = cleanupBooleanExpr(inner);
      if (!inner || inner === '1 = 1') {
        inner = '1 = 1';
      }

      const replacement =
        quantifier === '∃'
          ? `EXISTS (SELECT 1 FROM "${relation}" AS "${variable}" WHERE ${inner})`
          : `NOT EXISTS (SELECT 1 FROM "${relation}" AS "${variable}" WHERE NOT (${inner}))`;

      current = current.slice(0, start) + replacement + current.slice(end + 1);
      replaced = true;
      break;
    }

    if (!replaced) {
      throw new Error('Unable to parse one or more TRC quantifiers.');
    }
  }

  return current;
}

function parseProjectionTarget(target: string, mainVariable: string): string {
  const normalizedTarget = normalizeTextbookNotation(target);

  if (/^[a-zA-Z_]\w*$/.test(normalizedTarget)) {
    if (normalizedTarget !== mainVariable) {
      throw new Error(
        `Target variable '${normalizedTarget}' does not match range variable '${mainVariable}'.`,
      );
    }
    return `"${mainVariable}".*`;
  }

  const projectionMatch = normalizedTarget.match(/^<\s*([\s\S]+)\s*>$/);
  if (!projectionMatch) {
    throw new Error(
      'Invalid target. Use either a tuple variable (t) or projection tuple (<t.col1, t.col2>).',
    );
  }

  const rawColumns = projectionMatch[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawColumns.length === 0) {
    throw new Error('Projection target is empty.');
  }

  const columns = rawColumns.map((column) => {
    const attrMatch = column.match(/^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/);
    if (!attrMatch) {
      throw new Error(`Invalid projection attribute '${column}'. Use var.column form.`);
    }
    return `"${attrMatch[1]}"."${attrMatch[2]}"`;
  });

  return columns.join(', ');
}

export function tupleCalculusToSQL(input: string): string {
  const parsed = parseSetExpression(input);
  const target = normalizeTextbookNotation(normalizeQuantifierAliases(parsed.target));
  const formula = normalizeTextbookNotation(normalizeQuantifierAliases(parsed.formula));

  const mainVariableMatch =
    target.match(/^([a-zA-Z_]\w*)$/) ?? target.match(/^<\s*([a-zA-Z_]\w*)\./);
  if (!mainVariableMatch) {
    throw new Error('Unable to determine tuple variable from target.');
  }
  const mainVariable = mainVariableMatch[1];

  const mainRelation = inferMainRelation(formula, mainVariable);
  if (!mainRelation) {
    throw new Error(
      `Missing relation predicate for range variable '${mainVariable}' (e.g., students(${mainVariable}) or ${mainVariable} ∈ students).`,
    );
  }

  let whereClause = formula;
  whereClause = convertQuantifiers(whereClause);
  whereClause = whereClause.replace(
    new RegExp(`\\b${mainRelation}\\s*\\(\\s*${mainVariable}\\s*\\)`, 'g'),
    '1 = 1',
  );

  if (/\b[a-zA-Z_]\w*\s*\(\s*[a-zA-Z_]\w*\s*\)/.test(whereClause)) {
    throw new Error(
      'Unsupported free relation predicates. Use quantified variables (∃ or ∀) for additional tuple variables.',
    );
  }

  whereClause = normalizeLogicalOperators(whereClause);
  whereClause = quoteAttributeRefs(whereClause);
  whereClause = cleanupBooleanExpr(whereClause);
  if (!whereClause) {
    whereClause = '1 = 1';
  }

  const selectClause = parseProjectionTarget(target, mainVariable);

  return `SELECT ${selectClause} FROM "${mainRelation}" AS "${mainVariable}" WHERE ${whereClause};`;
}
