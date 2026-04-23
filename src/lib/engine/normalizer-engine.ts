import type {
  NormalForm,
  FunctionalDependency,
  NormalizerTable,
  DecompositionStep,
  Decomposition,
} from '@/types/normalizer';

const FORM_ORDER: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];
const MAX_EXPANDED_ROWS = 250;
const MAX_EXHAUSTIVE_DETERMINANT_COLUMNS = 7;
const MAX_HEURISTIC_DETERMINANT_SIZE = 3;

interface SingletonFD {
  determinant: string[];
  dependent: string;
}

interface DeterminantGroup {
  determinant: string[];
  dependents: Set<string>;
}

interface BCNFViolation {
  determinant: string[];
  dependent: string[];
}

interface FourNFViolation {
  determinant: string[];
  multivalued: string;
  pairedWith: string;
}

interface FiveNFViolation {
  relationSets: string[][];
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

function isSubset(subset: string[], superset: string[]): boolean {
  const superSet = new Set(superset);
  return subset.every((value) => superSet.has(value));
}

function isProperSubset(subset: string[], superset: string[]): boolean {
  return subset.length < superset.length && isSubset(subset, superset);
}

function areSameAttributeSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return isSubset(a, b);
}

function mergeSingletonFDs(singletons: SingletonFD[]): FunctionalDependency[] {
  const grouped = new Map<string, DeterminantGroup>();

  for (const fd of singletons) {
    const determinant = sortUnique(fd.determinant);
    if (determinant.includes(fd.dependent)) continue;

    const key = determinant.join('|');
    const existing = grouped.get(key);
    if (existing) {
      existing.dependents.add(fd.dependent);
      continue;
    }

    grouped.set(key, {
      determinant,
      dependents: new Set([fd.dependent]),
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      determinant: group.determinant,
      dependent: sortUnique([...group.dependents]),
    }))
    .filter((fd) => fd.determinant.length > 0 && fd.dependent.length > 0)
    .sort((a, b) => {
      const keyA = `${a.determinant.join(',')}->${a.dependent.join(',')}`;
      const keyB = `${b.determinant.join(',')}->${b.dependent.join(',')}`;
      return keyA.localeCompare(keyB);
    });
}

function expandToSingletonFDs(fds: FunctionalDependency[]): SingletonFD[] {
  const keySeen = new Set<string>();
  const singleton: SingletonFD[] = [];

  for (const fd of fds) {
    const determinant = sortUnique(fd.determinant);
    for (const dependent of fd.dependent) {
      if (determinant.includes(dependent)) continue;
      const key = `${determinant.join('|')}->${dependent}`;
      if (keySeen.has(key)) continue;
      keySeen.add(key);
      singleton.push({ determinant, dependent });
    }
  }

  return singleton;
}

function normalizeFDsToColumns(
  fds: FunctionalDependency[],
  columns: string[],
): FunctionalDependency[] {
  if (columns.length === 0) return [];

  const allowed = new Set(columns);
  const validFDs: FunctionalDependency[] = [];

  for (const fd of fds) {
    const determinant = sortUnique(fd.determinant);
    if (determinant.length === 0 || !determinant.every((attr) => allowed.has(attr))) continue;

    const dependent = sortUnique(
      fd.dependent.filter((attr) => allowed.has(attr) && !determinant.includes(attr)),
    );

    if (dependent.length === 0) continue;
    validFDs.push({ determinant, dependent });
  }

  return mergeSingletonFDs(expandToSingletonFDs(validFDs));
}

function columnIdentifierScore(columnName: string): number {
  const column = columnName.toLowerCase();
  if (column === 'id') return 5;
  if (column.endsWith('_id')) return 4;
  if (column.endsWith('id')) return 3;
  if (column.includes('key')) return 3;
  if (column.includes('code')) return 2;
  if (column.includes('num') || column.includes('number') || column.includes('no')) return 1;
  return 0;
}

function isLikelyIdentifierColumn(columnName: string): boolean {
  const column = columnName.toLowerCase();
  return (
    column === 'id' ||
    column.endsWith('_id') ||
    column.endsWith('id') ||
    column.includes('key') ||
    column.includes('code') ||
    column.includes('num') ||
    column.includes('number') ||
    column.includes('no') ||
    column.includes('uuid') ||
    column.includes('email') ||
    column.includes('reg') ||
    column.includes('roll')
  );
}

function isStrongStandaloneKeyColumn(columnName: string): boolean {
  const column = columnName.toLowerCase();
  if (column === 'id') return true;

  return (
    column.includes('uuid') ||
    column.includes('guid') ||
    column.includes('registration') ||
    column.includes('register') ||
    column.includes('roll') ||
    column.includes('email') ||
    column.includes('username') ||
    column.includes('user_name')
  );
}

function getIdentifierPrefix(columnName: string): string | null {
  const column = columnName.toLowerCase();
  if (column === 'id') return null;
  if (column.endsWith('_id')) return column.slice(0, -3);
  if (column.endsWith('id') && column.length > 2) return column.slice(0, -2);
  return null;
}

function alignRowsToColumns(columns: string[], rows: string[][]): string[][] {
  if (columns.length === 0) return [];

  return rows
    .map((row) => columns.map((_, index) => String(row[index] ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function rowSignature(row: string[], indexes: number[]): string {
  return indexes.map((index) => row[index] ?? '').join('\u001f');
}

function isUniqueOnIndexes(rows: string[][], indexes: number[]): boolean {
  if (rows.length === 0 || indexes.length === 0) return false;

  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(rowSignature(row, indexes));
  }

  return keys.size === rows.length;
}

function dependencyHoldsInRows(
  rows: string[][],
  determinantIndexes: number[],
  dependentIndex: number,
): { holds: boolean; hasRepeat: boolean; repeatedGroupCount: number } {
  const valueByDeterminant = new Map<string, string>();
  const determinantOccurrences = new Map<string, number>();

  for (const row of rows) {
    const determinantKey = rowSignature(row, determinantIndexes);
    const dependentValue = row[dependentIndex] ?? '';
    determinantOccurrences.set(determinantKey, (determinantOccurrences.get(determinantKey) ?? 0) + 1);

    const existing = valueByDeterminant.get(determinantKey);

    if (existing === undefined) {
      valueByDeterminant.set(determinantKey, dependentValue);
      continue;
    }

    if (existing !== dependentValue) {
      return { holds: false, hasRepeat: true, repeatedGroupCount: 0 };
    }
  }

  const repeatedGroupCount = [...determinantOccurrences.values()].filter((count) => count > 1).length;
  const hasRepeat = repeatedGroupCount > 0;

  return { holds: true, hasRepeat, repeatedGroupCount };
}

function columnHasDuplicateValues(rows: string[][], columnIndex: number): boolean {
  const seen = new Set<string>();

  for (const row of rows) {
    const value = row[columnIndex] ?? '';
    if (seen.has(value)) {
      return true;
    }
    seen.add(value);
  }

  return false;
}

function choosePrimaryKeyFromRows(columns: string[], rows: string[][]): string[] {
  if (columns.length === 0 || rows.length === 0) return [];

  const indexByColumn = new Map(columns.map((column, index) => [column, index]));
  const maxKeySize =
    columns.length <= MAX_EXHAUSTIVE_DETERMINANT_COLUMNS
      ? columns.length
      : Math.min(MAX_HEURISTIC_DETERMINANT_SIZE, columns.length);

  const minimalKeys: string[][] = [];

  for (let size = 1; size <= maxKeySize; size++) {
    for (const subset of combinations(columns, size)) {
      const determinant = sortUnique(subset);
      if (minimalKeys.some((key) => isSubset(key, determinant))) continue;

      const determinantIndexes = determinant
        .map((column) => indexByColumn.get(column))
        .filter((value): value is number => value !== undefined);
      if (determinantIndexes.length !== determinant.length) continue;

      if (isUniqueOnIndexes(rows, determinantIndexes)) {
        minimalKeys.push(determinant);
      }
    }

    if (minimalKeys.length > 0) break;
  }

  if (minimalKeys.length === 0) return [];

  return [...minimalKeys].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;

    const idScoreA = a.reduce((sum, column) => sum + columnIdentifierScore(column), 0);
    const idScoreB = b.reduce((sum, column) => sum + columnIdentifierScore(column), 0);
    if (idScoreA !== idScoreB) return idScoreB - idScoreA;

    const posScoreA = a.reduce((sum, column) => sum + (indexByColumn.get(column) ?? 0), 0);
    const posScoreB = b.reduce((sum, column) => sum + (indexByColumn.get(column) ?? 0), 0);
    if (posScoreA !== posScoreB) return posScoreA - posScoreB;

    return a.join(',').localeCompare(b.join(','));
  })[0];
}

export function inferPrimaryKey(
  columns: string[],
  rows: string[][],
  fds: FunctionalDependency[] = [],
): string[] {
  const attrs = uniqueInOrder(columns);
  if (attrs.length === 0) return [];

  const alignedRows = alignRowsToColumns(attrs, rows);
  const atomicRows = normalizeToFirstNormalFormRows(alignedRows);
  const keyFromRows = choosePrimaryKeyFromRows(attrs, atomicRows);
  if (keyFromRows.length > 0) return keyFromRows;

  if (fds.length > 0) {
    const keyFromFDs = findCandidateKeys(attrs, fds)[0] ?? [];
    if (keyFromFDs.length > 0) return keyFromFDs;
  }

  return attrs;
}

export function inferFunctionalDependencies(
  columns: string[],
  rows: string[][],
): FunctionalDependency[] {
  if (columns.length < 2) return [];

  const alignedRows = alignRowsToColumns(columns, rows);
  if (alignedRows.length === 0) return [];

  const indexByColumn = new Map(columns.map((column, index) => [column, index]));
  const keyByName = new Set<string>();
  const singletonFDs: SingletonFD[] = [];

  const addSingletonFD = (determinant: string[], dependent: string) => {
    const normalizedDeterminant = sortUnique(determinant);
    if (normalizedDeterminant.includes(dependent)) return;

    const key = `${normalizedDeterminant.join('|')}->${dependent}`;
    if (keyByName.has(key)) return;
    keyByName.add(key);
    singletonFDs.push({ determinant: normalizedDeterminant, dependent });
  };

  const inferredPrimaryKey = choosePrimaryKeyFromRows(columns, alignedRows);
  const inferredKeyIndexes = inferredPrimaryKey
    .map((column) => indexByColumn.get(column))
    .filter((value): value is number => value !== undefined);
  const duplicateEvidenceInKey =
    inferredKeyIndexes.length === inferredPrimaryKey.length &&
    inferredKeyIndexes.some((columnIndex) => columnHasDuplicateValues(alignedRows, columnIndex));

  const singleKeyAttr = inferredPrimaryKey.length === 1 ? inferredPrimaryKey[0] : null;
  const singleKeyAttrLower = singleKeyAttr?.toLowerCase() ?? null;
  const singleKeyPrefix = singleKeyAttr ? getIdentifierPrefix(singleKeyAttr) : null;
  const hasPrefixAlignedDependent =
    singleKeyPrefix !== null &&
    columns.some((column) => {
      const current = column.toLowerCase();
      if (singleKeyAttrLower === current) return false;
      return current === singleKeyPrefix || current.startsWith(`${singleKeyPrefix}_`);
    });

  const identifierBasedSingleKeyEvidence =
    singleKeyAttrLower === 'id' ||
    isStrongStandaloneKeyColumn(singleKeyAttr ?? '') ||
    (singleKeyPrefix !== null && hasPrefixAlignedDependent);

  const identifierBasedCompositeKeyEvidence =
    inferredPrimaryKey.length > 1 &&
    inferredPrimaryKey.every((column) => isLikelyIdentifierColumn(column));

  const allowUnrepeatedKeyDeterminants =
    duplicateEvidenceInKey ||
    (
      inferredKeyIndexes.length === inferredPrimaryKey.length &&
      (
        (inferredPrimaryKey.length === 1 && identifierBasedSingleKeyEvidence) ||
        identifierBasedCompositeKeyEvidence
      )
    );

  if (
    allowUnrepeatedKeyDeterminants &&
    inferredPrimaryKey.length > 0 &&
    inferredPrimaryKey.length < columns.length
  ) {
    const determinantKey = inferredPrimaryKey.length === 1 ? inferredPrimaryKey[0] : null;
    const determinantKeyLower = determinantKey?.toLowerCase() ?? null;
    const determinantPrefix = determinantKey ? getIdentifierPrefix(determinantKey) : null;

    for (const dependent of columns) {
      if (inferredPrimaryKey.includes(dependent)) continue;

      if (determinantKeyLower && determinantKeyLower !== 'id') {
        const dependentLower = dependent.toLowerCase();
        const dependentIsIdLike = columnIdentifierScore(dependent) >= 3;
        const dependentPrefixAligned =
          determinantPrefix !== null &&
          (dependentLower === determinantPrefix || dependentLower.startsWith(`${determinantPrefix}_`));

        // Prevent obvious cross-entity key noise such as course_id -> student_id.
        if (dependentIsIdLike && !dependentPrefixAligned) continue;
      }

      addSingletonFD(inferredPrimaryKey, dependent);
    }
  }

  const maxDeterminantSize =
    columns.length <= MAX_EXHAUSTIVE_DETERMINANT_COLUMNS
      ? columns.length - 1
      : Math.min(MAX_HEURISTIC_DETERMINANT_SIZE, columns.length - 1);

  for (let size = 1; size <= maxDeterminantSize; size++) {
    for (const subset of combinations(columns, size)) {
      const determinant = sortUnique(subset);
      const determinantIndexes = determinant
        .map((column) => indexByColumn.get(column))
        .filter((value): value is number => value !== undefined);
      if (determinantIndexes.length !== determinant.length) continue;

      for (const dependent of columns) {
        if (determinant.includes(dependent)) continue;

        const dependentIndex = indexByColumn.get(dependent);
        if (dependentIndex === undefined) continue;

        const { holds, hasRepeat, repeatedGroupCount } = dependencyHoldsInRows(
          alignedRows,
          determinantIndexes,
          dependentIndex,
        );
        if (!holds) continue;

        const equalsInferredKey =
          inferredPrimaryKey.length > 0 &&
          areSameAttributeSet(determinant, sortUnique(inferredPrimaryKey));

        if (!hasRepeat && !(equalsInferredKey && allowUnrepeatedKeyDeterminants)) continue;

        const isWeakSingleGroupEvidence = !equalsInferredKey && repeatedGroupCount === 1;
        if (isWeakSingleGroupEvidence && determinant.length === 1) {
          const determinantScore = columnIdentifierScore(determinant[0]);
          const dependentScore = columnIdentifierScore(dependent);

          // For weak evidence (only one repeated determinant group), orient dependencies
          // from identifier-like attributes to descriptive ones to avoid symmetric noise.
          if (determinantScore <= 0 || determinantScore < dependentScore) continue;
        }

        addSingletonFD(determinant, dependent);
      }
    }
  }

  if (singletonFDs.length === 0) return [];

  const groupedByDependent = new Map<string, SingletonFD[]>();
  for (const fd of singletonFDs) {
    const list = groupedByDependent.get(fd.dependent) ?? [];
    list.push(fd);
    groupedByDependent.set(fd.dependent, list);
  }

  const minimalSingletonFDs: SingletonFD[] = [];
  for (const [dependent, fdsForDependent] of groupedByDependent.entries()) {
    const sorted = [...fdsForDependent].sort((a, b) => {
      if (a.determinant.length !== b.determinant.length) {
        return a.determinant.length - b.determinant.length;
      }
      return a.determinant.join(',').localeCompare(b.determinant.join(','));
    });

    const kept: string[][] = [];
    for (const candidate of sorted) {
      if (kept.some((existing) => isSubset(existing, candidate.determinant))) {
        continue;
      }

      kept.push(candidate.determinant);
      minimalSingletonFDs.push({ determinant: candidate.determinant, dependent });
    }
  }

  return normalizeFDsToColumns(mergeSingletonFDs(minimalSingletonFDs), columns);
}

function parseMultiValueCell(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.length === 0) return [''];

  const looksLikeJsonObject = trimmed.startsWith('{') && trimmed.endsWith('}');
  const looksLikeJsonArray = trimmed.startsWith('[') && trimmed.endsWith(']');
  if (looksLikeJsonObject || looksLikeJsonArray) {
    return [trimmed];
  }

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((part) => part.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [trimmed];
  }

  if (trimmed.includes(';')) {
    const parts = trimmed.split(';').map((part) => part.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [trimmed];
  }

  if (trimmed.includes(',')) {
    const hasWhitespaceAdjacentToComma = /\s,|,\s/.test(trimmed);
    if (hasWhitespaceAdjacentToComma) {
      return [trimmed];
    }

    const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
    const allTokensSimple = parts.every((part) => !part.includes(' '));
    if (parts.length > 1 && allTokensSimple) {
      return parts;
    }
  }

  return [trimmed];
}

function hasMultiValuedCells(sampleData?: string[][]): boolean {
  if (!sampleData || sampleData.length === 0) return false;
  return sampleData.some((row) => row.some((cell) => parseMultiValueCell(cell).length > 1));
}

function splitAtomicValues(value: string): string[] {
  return parseMultiValueCell(value);
}

function dedupeRows(rows: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

function expandRowToAtomic(row: string[]): string[][] {
  const parsedCells = row.map((cell) => splitAtomicValues(cell));
  const lengths = parsedCells.map((parts) => parts.length);
  const maxLength = lengths.length > 0 ? Math.max(...lengths) : 1;

  if (maxLength <= 1) {
    return [parsedCells.map((parts) => parts[0] ?? '')];
  }

  const canZip = lengths.every((length) => length === 1 || length === maxLength);
  if (canZip) {
    const zippedRows: string[][] = [];
    for (let index = 0; index < maxLength && zippedRows.length < MAX_EXPANDED_ROWS; index++) {
      zippedRows.push(
        parsedCells.map((parts) =>
          parts.length === 1 ? parts[0] ?? '' : parts[index] ?? '',
        ),
      );
    }
    return zippedRows;
  }

  // Fallback for mismatched repeating-group lengths.
  let expandedRows: string[][] = [[]];
  for (const parts of parsedCells) {
    const nextRows: string[][] = [];
    for (const partialRow of expandedRows) {
      for (const part of parts) {
        nextRows.push([...partialRow, part]);
        if (nextRows.length >= MAX_EXPANDED_ROWS) {
          return nextRows;
        }
      }
    }
    expandedRows = nextRows;
  }

  return expandedRows;
}

function toFirstNormalFormRows(rows?: string[][]): string[][] | undefined {
  if (!rows || rows.length === 0) return rows;

  const expanded: string[][] = [];
  for (const row of rows) {
    const atomicRows = expandRowToAtomic(row);
    for (const atomicRow of atomicRows) {
      expanded.push(atomicRow);
      if (expanded.length >= MAX_EXPANDED_ROWS) {
        return dedupeRows(expanded);
      }
    }
  }

  return dedupeRows(expanded);
}

export function normalizeToFirstNormalFormRows(rows: string[][]): string[][] {
  return toFirstNormalFormRows(rows) ?? [];
}

function projectSampleData(table: NormalizerTable, targetColumns: string[]): string[][] | undefined {
  if (!table.sampleData || table.sampleData.length === 0) return undefined;
  if (targetColumns.length === 0) return undefined;

  const indexes = targetColumns.map((column) => table.columns.indexOf(column));
  if (indexes.some((index) => index < 0)) return undefined;

  const projectedRows = table.sampleData.map((row) =>
    indexes.map((index) => (index >= 0 ? row[index] ?? '' : '')),
  );

  return dedupeRows(projectedRows).slice(0, MAX_EXPANDED_ROWS);
}

function filterSubsetRelations(relations: string[][]): string[][] {
  const unique: string[][] = [];

  for (const relation of relations) {
    const normalized = sortUnique(relation);
    if (normalized.length === 0) continue;

    const duplicate = unique.some((existing) => areSameAttributeSet(existing, normalized));
    if (duplicate) continue;

    unique.push(normalized);
  }

  return unique.filter((relation, index) => {
    return !unique.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return relation.length < other.length && isSubset(relation, other);
    });
  });
}

function buildTable(
  sourceTable: NormalizerTable,
  name: string,
  columns: string[],
  sourceFDs: FunctionalDependency[],
  preferredKey?: string[],
): NormalizerTable {
  const normalizedColumns = sortUnique(columns);
  const scopedFDs = minimalCover(sourceFDs, normalizedColumns);
  const projectedSampleData = projectSampleData(sourceTable, normalizedColumns);

  let primaryKey = inferPrimaryKey(normalizedColumns, projectedSampleData ?? [], scopedFDs);
  if (preferredKey && preferredKey.length > 0 && isSubset(preferredKey, normalizedColumns)) {
    primaryKey = sortUnique(preferredKey);
  }

  return {
    name,
    columns: normalizedColumns,
    primaryKey,
    functionalDependencies: scopedFDs,
    sampleData: projectedSampleData,
  };
}

function getAtomicSampleRows(columns: string[], sampleData?: string[][]): string[][] {
  if (!sampleData || sampleData.length === 0 || columns.length === 0) return [];
  const alignedRows = alignRowsToColumns(columns, sampleData);
  const atomicRows = normalizeToFirstNormalFormRows(alignedRows);
  return dedupeRows(alignRowsToColumns(columns, atomicRows));
}

function tableShapeSignature(tables: NormalizerTable[]): string {
  return tables
    .map((table) => sortUnique(table.columns).join(','))
    .sort((a, b) => a.localeCompare(b))
    .join('||');
}

function isSuperKeyDeterminant(
  determinant: string[],
  columns: string[],
  fds: FunctionalDependency[],
): boolean {
  const closure = attributeClosure(determinant, fds);
  return columns.every((column) => closure.includes(column));
}

function hasIndependentCrossProduct(
  rows: string[][],
  columns: string[],
  determinant: string[],
  firstAttr: string,
  secondAttr: string,
): boolean {
  const indexByColumn = new Map(columns.map((column, index) => [column, index]));
  const determinantIndexes = determinant
    .map((column) => indexByColumn.get(column))
    .filter((value): value is number => value !== undefined);
  const firstIndex = indexByColumn.get(firstAttr);
  const secondIndex = indexByColumn.get(secondAttr);

  if (
    determinantIndexes.length !== determinant.length ||
    firstIndex === undefined ||
    secondIndex === undefined
  ) {
    return false;
  }

  const groupedRows = new Map<string, string[][]>();
  for (const row of rows) {
    const key = rowSignature(row, determinantIndexes);
    const list = groupedRows.get(key) ?? [];
    list.push(row);
    groupedRows.set(key, list);
  }

  let witnessGroupCount = 0;
  for (const groupRows of groupedRows.values()) {
    const firstValues = new Set<string>();
    const secondValues = new Set<string>();
    const pairValues = new Set<string>();

    for (const row of groupRows) {
      const firstValue = row[firstIndex] ?? '';
      const secondValue = row[secondIndex] ?? '';

      firstValues.add(firstValue);
      secondValues.add(secondValue);
      pairValues.add(`${firstValue}\u001e${secondValue}`);
    }

    if (firstValues.size < 2 || secondValues.size < 2) continue;

    witnessGroupCount += 1;
    if (pairValues.size !== firstValues.size * secondValues.size) {
      return false;
    }
  }

  return witnessGroupCount > 0;
}

function findFirst4NFViolation(
  columns: string[],
  fds: FunctionalDependency[],
  rows: string[][],
): FourNFViolation | null {
  if (columns.length < 3 || rows.length < 4) return null;

  const maxDeterminantSize = Math.min(2, Math.max(1, columns.length - 2));

  for (let size = 1; size <= maxDeterminantSize; size++) {
    for (const subset of combinations(columns, size)) {
      const determinant = sortUnique(subset);
      if (isSuperKeyDeterminant(determinant, columns, fds)) continue;

      const remaining = columns.filter((column) => !determinant.includes(column));
      if (remaining.length < 2) continue;

      for (let firstIndex = 0; firstIndex < remaining.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < remaining.length; secondIndex++) {
          const firstAttr = remaining[firstIndex];
          const secondAttr = remaining[secondIndex];

          if (hasIndependentCrossProduct(rows, columns, determinant, firstAttr, secondAttr)) {
            return {
              determinant,
              multivalued: firstAttr,
              pairedWith: secondAttr,
            };
          }

          if (hasIndependentCrossProduct(rows, columns, determinant, secondAttr, firstAttr)) {
            return {
              determinant,
              multivalued: secondAttr,
              pairedWith: firstAttr,
            };
          }
        }
      }
    }
  }

  return null;
}

function findFirst5NFViolation(columns: string[], rows: string[][]): FiveNFViolation | null {
  if (columns.length !== 3 || rows.length < 3) return null;

  const [attrA, attrB, attrC] = columns;
  const indexByColumn = new Map(columns.map((column, index) => [column, index]));
  const indexA = indexByColumn.get(attrA);
  const indexB = indexByColumn.get(attrB);
  const indexC = indexByColumn.get(attrC);

  if (indexA === undefined || indexB === undefined || indexC === undefined) return null;

  const original = new Set<string>();
  const projectionAB = new Set<string>();
  const projectionAC = new Set<string>();
  const projectionBC = new Set<string>();
  const cByA = new Map<string, Set<string>>();
  const cByB = new Map<string, Set<string>>();

  for (const row of rows) {
    const valueA = row[indexA] ?? '';
    const valueB = row[indexB] ?? '';
    const valueC = row[indexC] ?? '';

    original.add(`${valueA}\u001f${valueB}\u001f${valueC}`);
    projectionAB.add(`${valueA}\u001f${valueB}`);
    projectionAC.add(`${valueA}\u001f${valueC}`);
    projectionBC.add(`${valueB}\u001f${valueC}`);

    const cValuesForA = cByA.get(valueA) ?? new Set<string>();
    cValuesForA.add(valueC);
    cByA.set(valueA, cValuesForA);

    const cValuesForB = cByB.get(valueB) ?? new Set<string>();
    cValuesForB.add(valueC);
    cByB.set(valueB, cValuesForB);
  }

  if (
    projectionAB.size < 2 ||
    projectionAC.size < 2 ||
    projectionBC.size < 2 ||
    projectionAB.size === original.size ||
    projectionAC.size === original.size ||
    projectionBC.size === original.size
  ) {
    return null;
  }

  const joined = new Set<string>();

  for (const pair of projectionAB) {
    const [valueA, valueB] = pair.split('\u001f');
    const cValuesFromA = cByA.get(valueA);
    const cValuesFromB = cByB.get(valueB);

    if (!cValuesFromA || !cValuesFromB) continue;

    const iterateOn = cValuesFromA.size <= cValuesFromB.size ? cValuesFromA : cValuesFromB;
    const matchAgainst = iterateOn === cValuesFromA ? cValuesFromB : cValuesFromA;

    for (const valueC of iterateOn) {
      if (!matchAgainst.has(valueC)) continue;
      joined.add(`${valueA}\u001f${valueB}\u001f${valueC}`);
    }
  }

  if (joined.size !== original.size) return null;
  for (const tuple of original) {
    if (!joined.has(tuple)) return null;
  }

  return {
    relationSets: [
      sortUnique([attrA, attrB]),
      sortUnique([attrA, attrC]),
      sortUnique([attrB, attrC]),
    ],
  };
}

function findFirstBCNFViolation(
  columns: string[],
  fds: FunctionalDependency[],
): BCNFViolation | null {
  const cover = minimalCover(fds, columns);

  for (const fd of cover) {
    const nonTrivial = fd.dependent.filter((dep) => !fd.determinant.includes(dep));
    if (nonTrivial.length === 0) continue;

    const closure = attributeClosure(fd.determinant, cover);
    const isSuperKey = columns.every((column) => closure.includes(column));
    if (!isSuperKey) {
      return {
        determinant: fd.determinant,
        dependent: nonTrivial,
      };
    }
  }

  return null;
}

export function attributeClosure(attrs: string[], fds: FunctionalDependency[]): string[] {
  const scopedFDs = mergeSingletonFDs(expandToSingletonFDs(fds));
  const closure = new Set(attrs);
  let changed = true;

  while (changed) {
    changed = false;
    for (const fd of scopedFDs) {
      if (!fd.determinant.every((attr) => closure.has(attr))) continue;
      for (const dependent of fd.dependent) {
        if (closure.has(dependent)) continue;
        closure.add(dependent);
        changed = true;
      }
    }
  }

  return sortUnique([...closure]);
}

export function findCandidateKeys(allAttrs: string[], fds: FunctionalDependency[]): string[][] {
  const attributes = sortUnique(allAttrs);
  if (attributes.length === 0) return [[]];

  const scopedFDs = minimalCover(fds, attributes);
  const keys: string[][] = [];

  const n = attributes.length;
  for (let size = 1; size <= n; size++) {
    for (const subset of combinations(attributes, size)) {
      const closure = attributeClosure(subset, scopedFDs);
      if (!attributes.every((attr) => closure.includes(attr))) continue;

      const isMinimal = !keys.some((key) => isSubset(key, subset));
      if (!isMinimal) continue;

      keys.push(sortUnique(subset));
    }

    if (keys.length > 0) break;
  }

  return keys.length > 0 ? keys : [attributes];
}

function* combinations(arr: string[], size: number): Generator<string[]> {
  if (size === 0) {
    yield [];
    return;
  }

  for (let index = 0; index <= arr.length - size; index++) {
    for (const rest of combinations(arr.slice(index + 1), size - 1)) {
      yield [arr[index], ...rest];
    }
  }
}

function minimalCover(fds: FunctionalDependency[], columns: string[]): FunctionalDependency[] {
  let singleton = expandToSingletonFDs(normalizeFDsToColumns(fds, columns));

  if (singleton.length === 0) return [];

  for (let index = 0; index < singleton.length; index++) {
    let determinant = [...singleton[index].determinant];

    for (const attr of [...determinant]) {
      if (determinant.length <= 1) break;

      const reducedDeterminant = determinant.filter((candidate) => candidate !== attr);
      if (reducedDeterminant.length === 0) continue;

      const candidateSet = singleton.filter((_, fdIndex) => fdIndex !== index);

      const closure = attributeClosure(reducedDeterminant, mergeSingletonFDs(candidateSet));
      if (!closure.includes(singleton[index].dependent)) continue;

      determinant = reducedDeterminant;
      singleton[index] = {
        determinant,
        dependent: singleton[index].dependent,
      };
    }
  }

  singleton = expandToSingletonFDs(mergeSingletonFDs(singleton));

  let pointer = 0;
  while (pointer < singleton.length) {
    const current = singleton[pointer];
    const remainder = singleton.filter((_, index) => index !== pointer);
    const closure = attributeClosure(current.determinant, mergeSingletonFDs(remainder));

    if (closure.includes(current.dependent)) {
      singleton.splice(pointer, 1);
      continue;
    }

    pointer += 1;
  }

  return mergeSingletonFDs(singleton);
}

export function detectNormalForm(
  columns: string[],
  fds: FunctionalDependency[],
  candidateKeys?: string[][],
  sampleData?: string[][],
): NormalForm {
  const attrs = sortUnique(columns);
  if (attrs.length === 0) return 'UNF';
  if (hasMultiValuedCells(sampleData)) return 'UNF';

  const scopedFDs = minimalCover(fds, attrs);
  const atomicRows = getAtomicSampleRows(attrs, sampleData);
  const inferredPrimaryKey = inferPrimaryKey(attrs, atomicRows, scopedFDs);

  let keys = candidateKeys && candidateKeys.length > 0
    ? candidateKeys.map((key) => sortUnique(key))
    : findCandidateKeys(attrs, scopedFDs);

  if (inferredPrimaryKey.length > 0) {
    const inferredKeySignature = inferredPrimaryKey.join('|');
    const hasInferredInKeys = keys.some((key) => key.join('|') === inferredKeySignature);
    if (!hasInferredInKeys) {
      keys = [inferredPrimaryKey, ...keys];
    } else if (keys[0].join('|') !== inferredKeySignature) {
      keys = [
        inferredPrimaryKey,
        ...keys.filter((key) => key.join('|') !== inferredKeySignature),
      ];
    }
  }

  const primaryKey = keys[0] ?? attrs;
  const primaryKeySet = new Set(primaryKey);

  if (primaryKey.length > 1) {
    for (const fd of scopedFDs) {
      if (!isProperSubset(fd.determinant, primaryKey)) continue;

      const hasPartialNonKeyDependent = fd.dependent.some((dep) => !primaryKeySet.has(dep));
      if (hasPartialNonKeyDependent) return '1NF';
    }
  }

  for (const fd of scopedFDs) {
    const closure = attributeClosure(fd.determinant, scopedFDs);
    const isSuperKey = attrs.every((attr) => closure.includes(attr));
    if (isSuperKey) continue;

    const determinantTouchesPrimary = fd.determinant.some((attr) => primaryKeySet.has(attr));
    const hasTransitiveDependent = fd.dependent.some(
      (dep) => !fd.determinant.includes(dep) && !primaryKeySet.has(dep),
    );

    if (hasTransitiveDependent && determinantTouchesPrimary) return '2NF';
    if (hasTransitiveDependent) return '2NF';
  }

  for (const fd of scopedFDs) {
    const nonTrivialDeps = fd.dependent.filter((dep) => !fd.determinant.includes(dep));
    if (nonTrivialDeps.length === 0) continue;

    const closure = attributeClosure(fd.determinant, scopedFDs);
    const isSuperKey = attrs.every((attr) => closure.includes(attr));
    if (!isSuperKey) return '3NF';
  }

  if (atomicRows.length === 0) return 'BCNF';

  const fourNFViolation = findFirst4NFViolation(attrs, scopedFDs, atomicRows);
  if (fourNFViolation) return 'BCNF';

  const fiveNFViolation = findFirst5NFViolation(attrs, atomicRows);
  if (fiveNFViolation) return '4NF';

  return '5NF';
}

export function decompose(table: NormalizerTable, targetNF: NormalForm): Decomposition {
  const columns = uniqueInOrder(table.columns);
  const inputRows = table.sampleData
    ? alignRowsToColumns(columns, table.sampleData)
    : [];
  const rowsForInference = normalizeToFirstNormalFormRows(inputRows);
  const inferredFDs = inferFunctionalDependencies(columns, rowsForInference);
  const sourceFDs = minimalCover(
    table.functionalDependencies.length > 0 ? table.functionalDependencies : inferredFDs,
    columns,
  );

  const baseTable: NormalizerTable = {
    ...table,
    columns,
    functionalDependencies: sourceFDs,
    primaryKey:
      table.primaryKey.length > 0 && isSubset(table.primaryKey, columns)
        ? sortUnique(table.primaryKey)
        : inferPrimaryKey(columns, inputRows, sourceFDs),
    sampleData: table.sampleData ? inputRows : undefined,
  };

  const detectedNF = detectNormalForm(
    baseTable.columns,
    baseTable.functionalDependencies,
    undefined,
    baseTable.sampleData,
  );

  const steps: DecompositionStep[] = [
    {
      normalForm: 'UNF',
      tables: [baseTable],
      explanation:
        'Original relation captured as UNF input. Multi-valued cells can be separated with |, comma, or semicolon (for example: phone1|phone2 or phone1,phone2).',
    },
  ];

  const targetIdx = FORM_ORDER.indexOf(targetNF);
  const effectiveTargetIdx = targetIdx >= 0 ? targetIdx : FORM_ORDER.indexOf('BCNF');
  let currentTables: NormalizerTable[] = [baseTable];

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('1NF')) {
    const hadMultiValuedInput = hasMultiValuedCells(baseTable.sampleData);
    currentTables = decomposeTo1NF(currentTables);
    steps.push({
      normalForm: '1NF',
      tables: [...currentTables],
      explanation: hadMultiValuedInput
        ? 'Converted repeating values to atomic rows so each cell contains a single value (1NF).'
        : 'Input was already atomic, so no structural change was needed to satisfy 1NF.',
      anomalyFixed: hadMultiValuedInput
        ? 'Repeating-group anomaly reduced by flattening multi-valued cells.'
        : undefined,
    });
  }

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('2NF')) {
    currentTables = decomposeTo2NF(currentTables);
    steps.push({
      normalForm: '2NF',
      tables: [...currentTables],
      explanation:
        'Removed partial dependencies so every non-prime attribute depends on a whole candidate key, not part of one.',
      anomalyFixed: 'Partial dependency anomalies reduced.',
    });
  }

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('3NF')) {
    currentTables = decomposeTo3NF(currentTables);
    steps.push({
      normalForm: '3NF',
      tables: [...currentTables],
      explanation:
        'Applied 3NF synthesis from a minimal cover so non-key attributes depend only on keys and not transitively on non-key attributes.',
      anomalyFixed: 'Transitive dependency anomalies reduced.',
    });
  }

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('BCNF')) {
    currentTables = decomposeToBCNF(currentTables);
    steps.push({
      normalForm: 'BCNF',
      tables: [...currentTables],
      explanation: 'Decomposed by BCNF violations until every non-trivial FD has a superkey determinant.',
      anomalyFixed: 'Remaining non-superkey FD anomalies reduced.',
    });
  }

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('4NF')) {
    const previousShape = tableShapeSignature(currentTables);
    currentTables = decomposeTo4NF(currentTables);
    const changed = tableShapeSignature(currentTables) !== previousShape;

    steps.push({
      normalForm: '4NF',
      tables: [...currentTables],
      explanation: changed
        ? 'Removed non-trivial multivalued dependencies by splitting independent facts so each determinant-side relation is isolated (4NF).'
        : 'No non-trivial multivalued dependency violation was detected for the available sample rows; BCNF output already satisfies 4NF.',
      anomalyFixed: changed
        ? 'Multivalued dependency anomalies reduced.'
        : undefined,
    });
  }

  if (effectiveTargetIdx >= FORM_ORDER.indexOf('5NF')) {
    const previousShape = tableShapeSignature(currentTables);
    currentTables = decomposeTo5NF(currentTables);
    const changed = tableShapeSignature(currentTables) !== previousShape;

    steps.push({
      normalForm: '5NF',
      tables: [...currentTables],
      explanation: changed
        ? 'Resolved join-dependency patterns by decomposing into smaller lossless projections (5NF).'
        : 'No non-trivial join dependency was detected for the available sample rows, so the 4NF structure is retained as 5NF output.',
      anomalyFixed: changed
        ? 'Join dependency redundancy reduced.'
        : undefined,
    });
  }

  return {
    originalTable: baseTable,
    steps,
    currentNormalForm: detectedNF,
    targetNormalForm: targetNF,
  };
}

function decomposeTo1NF(tables: NormalizerTable[]): NormalizerTable[] {
  return tables.map((table) => ({
    ...table,
    sampleData: toFirstNormalFormRows(table.sampleData),
  }));
}

function splitBy2NFViolation(table: NormalizerTable): NormalizerTable[] {
  const columns = sortUnique(table.columns);
  const fds = minimalCover(table.functionalDependencies, columns);
  const keys = findCandidateKeys(columns, fds);
  const preferredPrimary =
    table.primaryKey.length > 0
      ? sortUnique(table.primaryKey.filter((attr) => columns.includes(attr)))
      : [];
  const primaryKey = preferredPrimary.length > 0 ? preferredPrimary : (keys[0] ?? columns);

  if (primaryKey.length <= 1) {
    return [buildTable(table, table.name, columns, fds, primaryKey)];
  }

  const primaryKeySet = new Set(primaryKey);
  const groupedPartials = new Map<string, DeterminantGroup>();

  for (const fd of fds) {
    const violatingDeps = fd.dependent.filter((dep) => {
      if (primaryKeySet.has(dep)) return false;
      return isProperSubset(fd.determinant, primaryKey);
    });

    if (violatingDeps.length === 0) continue;

    const determinant = sortUnique(fd.determinant);
    const detKey = determinant.join('|');
    const existing = groupedPartials.get(detKey);

    if (!existing) {
      groupedPartials.set(detKey, {
        determinant,
        dependents: new Set(violatingDeps),
      });
      continue;
    }

    for (const dep of violatingDeps) {
      existing.dependents.add(dep);
    }
  }

  if (groupedPartials.size === 0) {
    return [buildTable(table, table.name, columns, fds, primaryKey)];
  }

  const movedAttrs = new Set<string>();
  for (const group of groupedPartials.values()) {
    for (const dep of group.dependents) {
      movedAttrs.add(dep);
    }
  }

  const mainColumns = columns.filter((col) => !movedAttrs.has(col));
  const decomposition: NormalizerTable[] = [];

  if (mainColumns.length > 0) {
    decomposition.push(buildTable(table, table.name, mainColumns, fds, primaryKey));
  }

  for (const group of groupedPartials.values()) {
    const deps = sortUnique([...group.dependents]);
    const relationColumns = sortUnique([...group.determinant, ...deps]);
    const relationName = `${table.name}_${deps[0] ?? group.determinant[0] ?? 'part'}`;
    decomposition.push(buildTable(table, relationName, relationColumns, fds, group.determinant));
  }

  return decomposition;
}

function decomposeTo2NF(tables: NormalizerTable[]): NormalizerTable[] {
  const queue = [...tables];
  const result: NormalizerTable[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const next = splitBy2NFViolation(current);
    if (next.length <= 1) {
      result.push(next[0]);
      continue;
    }

    queue.push(...next);
  }

  return result;
}

function synthesize3NF(table: NormalizerTable): NormalizerTable[] {
  const columns = sortUnique(table.columns);
  const fds = minimalCover(table.functionalDependencies, columns);

  if (fds.length === 0) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const keys = findCandidateKeys(columns, fds);
  const relationSets: string[][] = fds.map((fd) => sortUnique([...fd.determinant, ...fd.dependent]));

  const hasKeyRelation = relationSets.some((relation) =>
    keys.some((key) => key.length > 0 && isSubset(key, relation)),
  );

  if (!hasKeyRelation) {
    relationSets.push(sortUnique(keys[0] ?? columns));
  }

  const minimizedRelations = filterSubsetRelations(relationSets);
  const keySet = new Set(keys[0] ?? []);
  const relations: NormalizerTable[] = [];

  minimizedRelations.forEach((relation, index) => {
    const suffix = relation.find((attr) => !keySet.has(attr)) ?? `r${index + 1}`;
    const relationName = index === 0 ? table.name : `${table.name}_${suffix}`;
    relations.push(buildTable(table, relationName, relation, fds));
  });

  return relations;
}

function decomposeTo3NF(tables: NormalizerTable[]): NormalizerTable[] {
  const result: NormalizerTable[] = [];

  for (const table of tables) {
    result.push(...synthesize3NF(table));
  }

  return result;
}

function splitByBCNFViolation(table: NormalizerTable): NormalizerTable[] {
  const columns = sortUnique(table.columns);
  const fds = minimalCover(table.functionalDependencies, columns);
  const violation = findFirstBCNFViolation(columns, fds);

  if (!violation) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const x = sortUnique(violation.determinant);
  const y = sortUnique(violation.dependent);
  const yWithoutX = y.filter((attr) => !x.includes(attr));

  const r1Columns = sortUnique([...x, ...y]);
  const r2Columns = sortUnique([...x, ...columns.filter((attr) => !yWithoutX.includes(attr))]);

  if (areSameAttributeSet(r1Columns, columns) || areSameAttributeSet(r2Columns, columns)) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const relation1 = buildTable(table, `${table.name}_${y[0] ?? 'bcnf'}`, r1Columns, fds, x);
  const relation2 = buildTable(table, table.name, r2Columns, fds);

  return [relation1, relation2];
}

function decomposeToBCNF(tables: NormalizerTable[]): NormalizerTable[] {
  const queue = [...tables];
  const result: NormalizerTable[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const next = splitByBCNFViolation(current);
    if (next.length <= 1) {
      result.push(next[0]);
      continue;
    }

    queue.push(...next);
  }

  return result;
}

function splitBy4NFViolation(table: NormalizerTable): NormalizerTable[] {
  const columns = sortUnique(table.columns);
  const fds = minimalCover(table.functionalDependencies, columns);
  const rows = getAtomicSampleRows(columns, table.sampleData);
  const violation = findFirst4NFViolation(columns, fds, rows);

  if (!violation) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const x = sortUnique(violation.determinant);
  const y = [violation.multivalued];
  const yWithoutX = y.filter((attr) => !x.includes(attr));

  const r1Columns = sortUnique([...x, ...y]);
  const r2Columns = sortUnique([...x, ...columns.filter((attr) => !yWithoutX.includes(attr))]);

  if (areSameAttributeSet(r1Columns, columns) || areSameAttributeSet(r2Columns, columns)) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const relation1 = buildTable(
    table,
    `${table.name}_${violation.multivalued}`,
    r1Columns,
    fds,
    x.length > 0 ? x : undefined,
  );
  const relation2 = buildTable(table, table.name, r2Columns, fds);

  return [relation1, relation2];
}

function decomposeTo4NF(tables: NormalizerTable[]): NormalizerTable[] {
  const queue = [...tables];
  const result: NormalizerTable[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const next = splitBy4NFViolation(current);
    if (next.length <= 1) {
      result.push(next[0]);
      continue;
    }

    queue.push(...next);
  }

  return result;
}

function splitBy5NFViolation(table: NormalizerTable): NormalizerTable[] {
  const columns = sortUnique(table.columns);
  const fds = minimalCover(table.functionalDependencies, columns);
  const rows = getAtomicSampleRows(columns, table.sampleData);
  const violation = findFirst5NFViolation(columns, rows);

  if (!violation) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  const relations = filterSubsetRelations(violation.relationSets);
  if (relations.length <= 1 || relations.some((relation) => areSameAttributeSet(relation, columns))) {
    return [buildTable(table, table.name, columns, fds, table.primaryKey)];
  }

  return relations.map((relation, index) => {
    const suffix = relation.join('_');
    const relationName = index === 0 ? table.name : `${table.name}_${suffix}`;
    return buildTable(table, relationName, relation, fds);
  });
}

function decomposeTo5NF(tables: NormalizerTable[]): NormalizerTable[] {
  const queue = [...tables];
  const result: NormalizerTable[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const next = splitBy5NFViolation(current);
    if (next.length <= 1) {
      result.push(next[0]);
      continue;
    }

    queue.push(...next);
  }

  return result;
}
