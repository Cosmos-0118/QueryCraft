function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function readWord(input: string, start: number): { word: string; end: number } {
  let i = start;
  while (i < input.length && isWordChar(input[i])) i += 1;
  return { word: input.slice(start, i), end: i };
}

function peekNextWord(input: string, start: number): string | null {
  let i = start;
  while (i < input.length && /\s/.test(input[i])) i += 1;
  if (i >= input.length || !isWordChar(input[i])) return null;
  const { word } = readWord(input, i);
  return word.toUpperCase();
}

export function splitSqlStatements(sql: string): string[] {
  const source = sql.trim();
  if (!source) return [];

  const statements: string[] = [];
  let buffer = '';

  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  let firstWords: string[] = [];
  let blockDepth = 0;
  let isTriggerBlock = false;
  let isRoutineBlock = false;
  let isPlSqlBlock = false;
  let seenPlSqlMainBegin = false;

  const resetStatementState = () => {
    firstWords = [];
    blockDepth = 0;
    isTriggerBlock = false;
    isRoutineBlock = false;
    isPlSqlBlock = false;
    seenPlSqlMainBegin = false;
  };

  const captureWord = (word: string, wordEnd: number) => {
    const upper = word.toUpperCase();
    if (firstWords.length < 3) {
      firstWords.push(upper);
      if (firstWords[0] === 'DECLARE') {
        isPlSqlBlock = true;
        blockDepth = 1;
      }
      if (firstWords[0] === 'BEGIN') {
        isPlSqlBlock = true;
        blockDepth = 1;
        seenPlSqlMainBegin = true;
      }
      if (firstWords[0] === 'CREATE' && firstWords[1] === 'TRIGGER') {
        isTriggerBlock = true;
      }
      if (
        firstWords[0] === 'CREATE' &&
        (firstWords[1] === 'PROCEDURE' || firstWords[1] === 'FUNCTION')
      ) {
        isRoutineBlock = true;
      }
    }

    if (isPlSqlBlock || isTriggerBlock || isRoutineBlock) {
      if (upper === 'BEGIN') {
        if (isPlSqlBlock && firstWords[0] === 'DECLARE' && !seenPlSqlMainBegin) {
          seenPlSqlMainBegin = true;
        } else {
          blockDepth += 1;
        }
      } else if (upper === 'END' && blockDepth > 0) {
        const nextWord = peekNextWord(source, wordEnd);
        const closesSubBlock = nextWord === 'IF' || nextWord === 'LOOP' || nextWord === 'CASE';
        if (!closesSubBlock) {
          blockDepth -= 1;
        }
      }
    }
  };

  while (i < source.length) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : '';

    if (inLineComment) {
      buffer += ch;
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      buffer += ch;
      if (ch === '*' && next === '/') {
        buffer += '/';
        inBlockComment = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-') {
        buffer += ch;
        buffer += next;
        inLineComment = true;
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        buffer += ch;
        buffer += next;
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    if (!inDouble && !inBacktick && ch === "'") {
      inSingle = !inSingle;
      buffer += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      buffer += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      buffer += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && isWordChar(ch)) {
      const { word, end } = readWord(source, i);
      captureWord(word, end);
      buffer += source.slice(i, end);
      i = end;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';' && blockDepth === 0) {
      const stmt = buffer.trim();
      if (stmt) statements.push(`${stmt};`);
      buffer = '';
      resetStatementState();
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  const tail = buffer.trim();
  if (tail) {
    statements.push(tail.endsWith(';') ? tail : `${tail};`);
  }

  return statements;
}
