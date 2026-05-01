import type {
  AnomalyDemo,
  Column,
  FunctionalDependency,
  JoinDependency,
  MultivaluedDependency,
  NormalForm,
  NormalizationResult,
  NormalizationStep,
  TableSchema,
  Violation,
} from '@/types/normalizer';

const NF_ORDER: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF'];
const MULTI_VALUE_CELL_REGEX = /[|;,]/;
const TUPLE_SEPARATOR = '\u241F';

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0).map((value) => value.trim())));
}

function normalizeSet(values: string[]): string[] {
  return uniq(values).sort((a, b) => a.localeCompare(b));
}

function setKey(values: string[]): string {
  return normalizeSet(values).join('::');
}

function orderByColumns(values: string[], columns: string[]): string[] {
  const idx = new Map(columns.map((column, index) => [column, index]));
  return uniq(values).sort((a, b) => (idx.get(a) ?? Number.MAX_SAFE_INTEGER) - (idx.get(b) ?? Number.MAX_SAFE_INTEGER));
}

function columnNames(table: TableSchema): string[] {
  return table.columns.map((column) => column.name);
}

function cloneFD(fd: FunctionalDependency): FunctionalDependency {
  return {
    determinant: [...fd.determinant],
    dependent: [...fd.dependent],
  };
}

function cloneMVD(mvd: MultivaluedDependency): MultivaluedDependency {
  return {
    determinant: [...mvd.determinant],
    dependent: [...mvd.dependent],
  };
}

function cloneJD(jd: JoinDependency): JoinDependency {
  return {
    components: jd.components.map((component) => [...component]),
  };
}

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
    fds: table.fds.map(cloneFD),
    mvds: table.mvds.map(cloneMVD),
    joinDependencies: table.joinDependencies?.map(cloneJD),
    sampleData: table.sampleData?.map((row) => [...row]),
  };
}

function cloneTables(tables: TableSchema[]): TableSchema[] {
  return tables.map(cloneTable);
}

function normalizeFD(fd: FunctionalDependency): FunctionalDependency | null {
  const determinant = normalizeSet(fd.determinant);
  const dependent = normalizeSet(fd.dependent).filter((attribute) => !determinant.includes(attribute));
  if (determinant.length === 0 || dependent.length === 0) return null;
  return { determinant, dependent };
}

function normalizeFDs(fds: FunctionalDependency[]): FunctionalDependency[] {
  const seen = new Set<string>();
  const normalized: FunctionalDependency[] = [];
  for (const fd of fds) {
    const next = normalizeFD(fd);
    if (!next) continue;
    const key = `${setKey(next.determinant)}->${setKey(next.dependent)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(next);
  }
  return normalized;
}

function normalizeMVD(mvd: MultivaluedDependency): MultivaluedDependency | null {
  const determinant = normalizeSet(mvd.determinant);
  const dependent = normalizeSet(mvd.dependent).filter((attribute) => !determinant.includes(attribute));
  if (determinant.length === 0 || dependent.length === 0) return null;
  return { determinant, dependent };
}

function normalizeMVDs(mvds: MultivaluedDependency[]): MultivaluedDependency[] {
  const seen = new Set<string>();
  const normalized: MultivaluedDependency[] = [];
  for (const mvd of mvds) {
    const next = normalizeMVD(mvd);
    if (!next) continue;
    const key = `${setKey(next.determinant)}->>${setKey(next.dependent)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(next);
  }
  return normalized;
}

function inferColumnType(values: string[]): string | undefined {
  const nonEmpty = values.filter((value) => value.trim().length > 0);
  if (nonEmpty.length === 0) return undefined;
  const allNumbers = nonEmpty.every((value) => /^-?\d+(\.\d+)?$/.test(value));
  if (allNumbers) return 'number';
  const allDates = nonEmpty.every((value) => !Number.isNaN(Date.parse(value)));
  if (allDates) return 'date';
  return 'text';
}

function sanitizeTable(table: TableSchema): TableSchema {
  const columns = table.columns
    .map((column) => ({
      ...column,
      name: column.name.trim(),
    }))
    .filter((column) => column.name.length > 0);

  const names = uniq(columns.map((column) => column.name));
  const normalizedColumns: Column[] = names.map((name) => {
    const source = columns.find((column) => column.name === name);
    return {
      name,
      type: source?.type,
      isKey: source?.isKey ?? false,
    };
  });

  const mappedSampleData = table.sampleData?.map((row) => {
    const trimmed = row.map((cell) => cell.trim());
    return names.map((_, index) => trimmed[index] ?? '');
  });

  for (let index = 0; index < normalizedColumns.length; index += 1) {
    if (!normalizedColumns[index].type && mappedSampleData && mappedSampleData.length > 0) {
      const values = mappedSampleData.map((row) => row[index] ?? '');
      normalizedColumns[index].type = inferColumnType(values);
    }
  }

  const primaryKey = orderByColumns(uniq(table.primaryKey), names).filter((attribute) => names.includes(attribute));
  const fds = normalizeFDs(table.fds ?? []);
  const mvds = normalizeMVDs(table.mvds ?? []);
  const joinDependencies = (table.joinDependencies ?? [])
    .map((jd) => ({
      components: jd.components.map((component) => orderByColumns(uniq(component), names).filter((attribute) => names.includes(attribute))),
    }))
    .filter((jd) => jd.components.length > 0);

  const columnSet = new Set(names);

  const foreignKeys = table.foreignKeys
    .map((foreignKey) => ({
      columns: orderByColumns(uniq(foreignKey.columns), names).filter((column) => columnSet.has(column)),
      referencesTable: foreignKey.referencesTable,
      referencesColumns: uniq(foreignKey.referencesColumns),
    }))
    .filter((foreignKey) => foreignKey.columns.length > 0 && foreignKey.referencesColumns.length > 0);

  const fallbackPk = primaryKey.length > 0
    ? primaryKey
    : orderByColumns(
      normalizedColumns.filter((column) => column.isKey).map((column) => column.name),
      names,
    );

  const adjustedColumns = normalizedColumns.map((column) => ({
    ...column,
    isKey: fallbackPk.includes(column.name),
  }));

  return {
    ...table,
    id: table.id.trim() || slug(table.name) || 'table',
    name: table.name.trim() || table.id || 'Table',
    columns: adjustedColumns,
    primaryKey: fallbackPk,
    foreignKeys,
    fds,
    mvds,
    joinDependencies,
    sampleData: mappedSampleData,
  };
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'table';
}

function isIdentifierLike(attribute: string): boolean {
  return /(^id$|_id$|id$|key$|_key$|code$|number$|no$)/i.test(attribute);
}

function stringifyTuple(values: string[]): string {
  return values.join(TUPLE_SEPARATOR);
}

function splitMultiValueCell(cell: string): string[] {
  if (!MULTI_VALUE_CELL_REGEX.test(cell)) return [cell.trim()];
  const parts = cell
    .split(/[|;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [cell.trim()];
}

function hasMultiValuedCells(table: TableSchema): boolean {
  if (!table.sampleData || table.sampleData.length === 0) return false;
  return table.sampleData.some((row) => row.some((cell) => splitMultiValueCell(cell).length > 1));
}

function resolveFDs(table: TableSchema): FunctionalDependency[] {
  if (table.fds.length > 0) return minimalCover(table.fds);
  if (!table.sampleData || table.sampleData.length === 0) return [];
  return inferFunctionalDependencies(columnNames(table), table.sampleData);
}

function resolveCandidateKeys(table: TableSchema, fds: FunctionalDependency[]): string[][] {
  const attrs = columnNames(table);
  if (attrs.length === 0) return [];

  if (fds.length > 0) {
    const keys = findCandidateKeys(attrs, fds).map((key) => orderByColumns(key, attrs));
    if (keys.length > 0) return keys;
  }

  const inferredPrimary = table.primaryKey.length > 0
    ? orderByColumns(table.primaryKey, attrs)
    : inferPrimaryKey(attrs, table.sampleData ?? [], fds);

  if (inferredPrimary.length > 0) return [inferredPrimary];
  return [attrs];
}

function buildPrimeSet(candidateKeys: string[][]): Set<string> {
  const prime = new Set<string>();
  for (const key of candidateKeys) {
    for (const attribute of key) {
      prime.add(attribute);
    }
  }
  return prime;
}

function nonTrivialSingletonFDs(fds: FunctionalDependency[]): FunctionalDependency[] {
  return expandToSingletonFDs(fds).filter((fd) => !isSubset(fd.dependent, fd.determinant));
}

function getPartialViolations(table: TableSchema, fds: FunctionalDependency[], candidateKeys: string[][]): Violation[] {
  const violations: Violation[] = [];
  if (candidateKeys.every((candidateKey) => candidateKey.length <= 1)) return violations;

  const prime = buildPrimeSet(candidateKeys);
  for (const fd of nonTrivialSingletonFDs(fds)) {
    for (const key of candidateKeys) {
      if (key.length <= 1) continue;
      if (!isProperSubset(fd.determinant, key)) continue;
      if (fd.dependent.every((dependent) => prime.has(dependent))) continue;

      violations.push({
        type: 'partial',
        determinant: [...fd.determinant],
        dependent: [...fd.dependent],
        explanation: `${fd.dependent.join(', ')} depends on only part of key ${key.join(', ')}`,
      });
    }
  }

  return dedupeViolations(violations);
}

function getTransitiveViolations(
  table: TableSchema,
  fds: FunctionalDependency[],
  candidateKeys: string[][],
): Violation[] {
  const violations: Violation[] = [];
  const attrs = columnNames(table);
  const prime = buildPrimeSet(candidateKeys);

  for (const fd of nonTrivialSingletonFDs(fds)) {
    if (isSuperKey(fd.determinant, attrs, fds)) continue;
    if (fd.dependent.every((dependent) => prime.has(dependent))) continue;

    violations.push({
      type: 'transitive',
      determinant: [...fd.determinant],
      dependent: [...fd.dependent],
      explanation: `${fd.determinant.join(', ')} is not a key but determines ${fd.dependent.join(', ')}`,
    });
  }

  return dedupeViolations(violations);
}

function getBCNFViolations(table: TableSchema, fds: FunctionalDependency[]): Violation[] {
  const attrs = columnNames(table);
  const violations: Violation[] = [];

  for (const fd of nonTrivialSingletonFDs(fds)) {
    if (isSuperKey(fd.determinant, attrs, fds)) continue;
    violations.push({
      type: 'bcnf',
      determinant: [...fd.determinant],
      dependent: [...fd.dependent],
      explanation: `${fd.determinant.join(', ')} is not a superkey in BCNF check`,
    });
  }

  return dedupeViolations(violations);
}

function isNonTrivialMVD(
  determinant: string[],
  dependent: string[],
  attributes: string[],
): boolean {
  if (dependent.length === 0) return false;
  if (isSubset(dependent, determinant)) return false;
  const union = normalizeSet([...determinant, ...dependent]);
  return !areSameSet(union, attributes);
}

function getMVDViolations(table: TableSchema, fds: FunctionalDependency[]): Violation[] {
  const attrs = columnNames(table);
  const violations: Violation[] = [];

  for (const mvd of table.mvds) {
    if (!isNonTrivialMVD(mvd.determinant, mvd.dependent, attrs)) continue;
    if (isSuperKey(mvd.determinant, attrs, fds)) continue;

    violations.push({
      type: 'mvd',
      determinant: [...mvd.determinant],
      dependent: [...mvd.dependent],
      explanation: `${mvd.determinant.join(', ')} ->> ${mvd.dependent.join(', ')} violates 4NF`,
    });
  }

  return dedupeViolations(violations);
}

function getJDViolations(table: TableSchema, fds: FunctionalDependency[]): Violation[] {
  const attrs = columnNames(table);
  const violations: Violation[] = [];

  for (const jd of table.joinDependencies ?? []) {
    if (jd.components.length < 3) continue;

    const normalizedComponents = jd.components
      .map((component) => normalizeSet(component).filter((attribute) => attrs.includes(attribute)))
      .filter((component) => component.length > 0);

    if (normalizedComponents.length < 3) continue;

    const union = normalizeSet(normalizedComponents.flat());
    if (!areSameSet(union, attrs)) continue;

    const allProperSubsets = normalizedComponents.every((component) => isProperSubset(component, attrs));
    if (!allProperSubsets) continue;

    const componentIsSuperKey = normalizedComponents.some((component) => isSuperKey(component, attrs, fds));
    if (componentIsSuperKey) continue;

    const determinant = normalizedComponents[0];
    const dependent = normalizeSet(normalizedComponents.slice(1).flat());

    violations.push({
      type: 'jd',
      determinant,
      dependent,
      explanation: `Join dependency ${normalizedComponents.map((component) => `(${component.join(', ')})`).join(' * ')} needs 5NF decomposition`,
    });
  }

  return dedupeViolations(violations);
}

function dedupeViolations(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  const out: Violation[] = [];
  for (const violation of violations) {
    const key = `${violation.type}|${setKey(violation.determinant)}|${setKey(violation.dependent)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(violation);
  }
  return out;
}

function tableFromAttributes(
  source: TableSchema,
  attrs: string[],
  idSuffix: string,
  tableName: string,
  explicitPrimaryKey?: string[],
): TableSchema {
  const sourceColumnsByName = new Map(source.columns.map((column) => [column.name, column]));
  const selected = orderByColumns(attrs, columnNames(source));
  const columns = selected.map((name) => {
    const sourceColumn = sourceColumnsByName.get(name);
    return {
      name,
      type: sourceColumn?.type,
      isKey: false,
    } satisfies Column;
  });

  const projectedFDs = normalizeFDs(
    source.fds.filter((fd) => isSubset(fd.determinant, selected) && isSubset(fd.dependent, selected)),
  );

  const projectedMVDs = normalizeMVDs(
    source.mvds.filter((mvd) => isSubset(mvd.determinant, selected) && isSubset(mvd.dependent, selected)),
  );

  const candidatePrimary = explicitPrimaryKey && explicitPrimaryKey.length > 0
    ? orderByColumns(explicitPrimaryKey, selected)
    : inferPrimaryKey(selected, projectRows(source, selected), projectedFDs);

  const foreignKeys = source.foreignKeys
    .map((foreignKey) => ({
      columns: orderByColumns(foreignKey.columns.filter((column) => selected.includes(column)), selected),
      referencesTable: foreignKey.referencesTable,
      referencesColumns: [...foreignKey.referencesColumns],
    }))
    .filter((foreignKey) => foreignKey.columns.length > 0);

  const sampleData = projectRows(source, selected);

  const finalColumns = columns.map((column) => ({
    ...column,
    isKey: candidatePrimary.includes(column.name),
  }));

  return {
    id: `${slug(source.id || source.name)}_${idSuffix}`,
    name: tableName,
    columns: finalColumns,
    primaryKey: candidatePrimary,
    foreignKeys,
    fds: projectedFDs,
    mvds: projectedMVDs,
    joinDependencies: source.joinDependencies
      ?.map((jd) => ({
        components: jd.components
          .map((component) => orderByColumns(component.filter((attribute) => selected.includes(attribute)), selected))
          .filter((component) => component.length > 0),
      }))
      .filter((jd) => jd.components.length > 1),
    sampleData,
  };
}

function projectRows(table: TableSchema, attrs: string[]): string[][] {
  if (!table.sampleData || table.sampleData.length === 0) return [];
  const indexes = attrs.map((attr) => columnNames(table).indexOf(attr));
  return table.sampleData.map((row) => indexes.map((index) => (index >= 0 ? row[index] ?? '' : '')));
}

function inferForeignKeys(tables: TableSchema[]): TableSchema[] {
  const result = cloneTables(tables);

  for (let childIndex = 0; childIndex < result.length; childIndex += 1) {
    const child = result[childIndex];
    const childAttrs = columnNames(child);
    const inferred = [...child.foreignKeys];

    for (let parentIndex = 0; parentIndex < result.length; parentIndex += 1) {
      if (childIndex === parentIndex) continue;
      const parent = result[parentIndex];
      if (parent.primaryKey.length === 0) continue;

      const parentKey = orderByColumns(parent.primaryKey, childAttrs);
      if (!isSubset(parentKey, childAttrs)) continue;
      if (areSameSet(parentKey, child.primaryKey)) continue;

      const exists = inferred.some((foreignKey) =>
        areSameSet(foreignKey.columns, parentKey) &&
        foreignKey.referencesTable === parent.name &&
        areSameSet(foreignKey.referencesColumns, parent.primaryKey),
      );

      if (!exists) {
        inferred.push({
          columns: parentKey,
          referencesTable: parent.name,
          referencesColumns: [...parent.primaryKey],
        });
      }
    }

    result[childIndex] = {
      ...child,
      foreignKeys: inferred,
    };
  }

  return result;
}

function withResolvedMetadata(table: TableSchema): TableSchema {
  const cleaned = sanitizeTable(table);
  const cols = columnNames(cleaned);
  const fds = cleaned.fds.length > 0
    ? minimalCover(cleaned.fds)
    : inferFunctionalDependencies(cols, cleaned.sampleData ?? []);

  const primaryKey = cleaned.primaryKey.length > 0
    ? orderByColumns(cleaned.primaryKey, cols)
    : inferPrimaryKey(cols, cleaned.sampleData ?? [], fds);

  return {
    ...cleaned,
    fds,
    primaryKey,
    columns: cleaned.columns.map((column) => ({
      ...column,
      isKey: primaryKey.includes(column.name),
    })),
  };
}

function normalFormIndex(normalForm: NormalForm): number {
  return NF_ORDER.indexOf(normalForm);
}

function explainTransition(
  fromNF: NormalForm,
  toNF: NormalForm,
  violations: Violation[],
  inputCount: number,
  outputCount: number,
): string {
  if (toNF === '1NF') {
    return 'Converted repeating or multi-valued cells to atomic values so each row-column intersection holds one value.';
  }

  if (violations.length === 0) {
    return `No ${toNF} violations were detected, so the schema remained unchanged (${inputCount} table${inputCount === 1 ? '' : 's'}).`;
  }

  const reason = {
    '2NF': 'partial dependencies on a composite key',
    '3NF': 'transitive dependencies',
    BCNF: 'determinants that are not superkeys',
    '4NF': 'non-trivial multivalued dependencies',
    '5NF': 'join dependencies requiring projection decomposition',
  } as const;

  const key = toNF as keyof typeof reason;
  return `Resolved ${reason[key]} while moving from ${fromNF} to ${toNF}. Produced ${outputCount} table${outputCount === 1 ? '' : 's'} from ${inputCount}.`;
}

function anomalyForViolations(violations: Violation[]): AnomalyDemo | undefined {
  if (violations.length === 0) return undefined;

  if (violations.some((violation) => violation.type === 'partial')) {
    return {
      insertAnomaly: 'You cannot add dependent facts without duplicating key fragments.',
      updateAnomaly: 'Changing a dependent value requires updating many rows with the same key part.',
      deleteAnomaly: 'Deleting the last tuple for a key part may remove unrelated reference data.',
    };
  }

  if (violations.some((violation) => violation.type === 'transitive')) {
    return {
      updateAnomaly: 'A transitive attribute is duplicated across rows and can drift out of sync.',
      deleteAnomaly: 'Removing tuples can accidentally drop information about determinant entities.',
    };
  }

  if (violations.some((violation) => violation.type === 'bcnf')) {
    return {
      updateAnomaly: 'A non-key determinant duplicates dependent values and causes inconsistent updates.',
    };
  }

  if (violations.some((violation) => violation.type === 'mvd')) {
    return {
      insertAnomaly: 'Independent multivalued facts force artificial combinations during inserts.',
      deleteAnomaly: 'Deleting one combination can erase unrelated multivalued facts.',
    };
  }

  if (violations.some((violation) => violation.type === 'jd')) {
    return {
      insertAnomaly: 'Independent projections require synthetic tuples to reconstruct valid joins.',
      updateAnomaly: 'Changes across join components are hard to keep consistent in one wide table.',
    };
  }

  return undefined;
}

function collectViolationsForStep(table: TableSchema, toNF: NormalForm): Violation[] {
  const fds = resolveFDs(table);
  const keys = resolveCandidateKeys(table, fds);

  if (toNF === '2NF') return getPartialViolations(table, fds, keys);
  if (toNF === '3NF') return getTransitiveViolations(table, fds, keys);
  if (toNF === 'BCNF') return getBCNFViolations(table, fds);
  if (toNF === '4NF') return getMVDViolations(table, fds);
  if (toNF === '5NF') return getJDViolations(table, fds);
  return [];
}

export function isSubset(a: string[], b: string[]): boolean {
  const bSet = new Set(b);
  return uniq(a).every((value) => bSet.has(value));
}

export function isProperSubset(a: string[], b: string[]): boolean {
  const left = uniq(a);
  const right = uniq(b);
  return left.length < right.length && isSubset(left, right);
}

export function areSameSet(a: string[], b: string[]): boolean {
  return isSubset(a, b) && isSubset(b, a);
}

export function* combinations<T>(arr: T[], size: number): Generator<T[]> {
  if (size < 0 || size > arr.length) return;
  if (size === 0) {
    yield [];
    return;
  }

  const combo: T[] = [];

  function* dfs(start: number, remaining: number): Generator<T[]> {
    if (remaining === 0) {
      yield [...combo];
      return;
    }

    for (let index = start; index <= arr.length - remaining; index += 1) {
      combo.push(arr[index]);
      yield* dfs(index + 1, remaining - 1);
      combo.pop();
    }
  }

  yield* dfs(0, size);
}

export function expandToSingletonFDs(fds: FunctionalDependency[]): FunctionalDependency[] {
  const normalized = normalizeFDs(fds);
  const expanded: FunctionalDependency[] = [];
  const seen = new Set<string>();

  for (const fd of normalized) {
    for (const dependent of fd.dependent) {
      const next: FunctionalDependency = {
        determinant: [...fd.determinant],
        dependent: [dependent],
      };
      const key = `${setKey(next.determinant)}->${dependent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expanded.push(next);
    }
  }

  return expanded;
}

export function mergeSingletonFDs(singletons: FunctionalDependency[]): FunctionalDependency[] {
  const grouped = new Map<string, { determinant: string[]; dependent: Set<string> }>();

  for (const fd of expandToSingletonFDs(singletons)) {
    const key = setKey(fd.determinant);
    const existing = grouped.get(key);
    if (existing) {
      existing.dependent.add(fd.dependent[0]);
      continue;
    }

    grouped.set(key, {
      determinant: [...fd.determinant],
      dependent: new Set(fd.dependent),
    });
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      determinant: [...entry.determinant],
      dependent: Array.from(entry.dependent).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => {
      if (left.determinant.length !== right.determinant.length) {
        return left.determinant.length - right.determinant.length;
      }
      return setKey(left.determinant).localeCompare(setKey(right.determinant));
    });
}

export function attributeClosure(attrs: string[], fds: FunctionalDependency[]): string[] {
  const closure = new Set(uniq(attrs));
  const singletons = expandToSingletonFDs(fds);

  let changed = true;
  while (changed) {
    changed = false;

    for (const fd of singletons) {
      if (!isSubset(fd.determinant, Array.from(closure))) continue;

      const dependent = fd.dependent[0];
      if (closure.has(dependent)) continue;
      closure.add(dependent);
      changed = true;
    }
  }

  return Array.from(closure).sort((a, b) => a.localeCompare(b));
}

export function isSuperKey(attrs: string[], columns: string[], fds: FunctionalDependency[]): boolean {
  const domain = uniq(columns);
  if (domain.length === 0) return false;
  const closure = attributeClosure(attrs, fds);
  return isSubset(domain, closure);
}

export function minimalCover(fds: FunctionalDependency[]): FunctionalDependency[] {
  const singletons = expandToSingletonFDs(fds);
  if (singletons.length === 0) return [];

  const reduced = singletons.map((fd) => ({
    determinant: [...fd.determinant],
    dependent: [...fd.dependent],
  }));

  for (let index = 0; index < reduced.length; index += 1) {
    const fd = reduced[index];
    let changed = true;

    while (changed) {
      changed = false;

      for (const attribute of [...fd.determinant]) {
        if (fd.determinant.length === 1) continue;

        const trialDeterminant = fd.determinant.filter((item) => item !== attribute);
        const trialSet = reduced.filter((_, currentIndex) => currentIndex !== index);

        const closure = attributeClosure(trialDeterminant, trialSet);
        if (closure.includes(fd.dependent[0])) {
          fd.determinant = trialDeterminant;
          changed = true;
        }
      }
    }
  }

  const dedupedReduced: FunctionalDependency[] = [];
  const seen = new Set<string>();
  for (const fd of reduced) {
    const key = `${setKey(fd.determinant)}->${fd.dependent[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedReduced.push(fd);
  }

  const noRedundant: FunctionalDependency[] = [];
  for (let index = 0; index < dedupedReduced.length; index += 1) {
    const fd = dedupedReduced[index];
    const others = dedupedReduced.filter((_, currentIndex) => currentIndex !== index);
    const closure = attributeClosure(fd.determinant, others);

    if (!closure.includes(fd.dependent[0])) {
      noRedundant.push(fd);
    }
  }

  return mergeSingletonFDs(noRedundant);
}

export function findCandidateKeys(columns: string[], fds: FunctionalDependency[]): string[][] {
  const attrs = uniq(columns);
  if (attrs.length === 0) return [];

  const normalizedFDs = normalizeFDs(fds);
  const rhs = new Set(normalizedFDs.flatMap((fd) => fd.dependent));
  const essential = attrs.filter((attr) => !rhs.has(attr));
  const remaining = attrs.filter((attr) => !essential.includes(attr));

  const candidates: string[][] = [];

  for (let size = 0; size <= remaining.length; size += 1) {
    for (const combo of combinations(remaining, size)) {
      const tentative = orderByColumns([...essential, ...combo], attrs);

      const minimal = candidates.every((candidate) => !isSubset(candidate, tentative));
      if (!minimal) continue;

      const closure = attributeClosure(tentative, normalizedFDs);
      if (!isSubset(attrs, closure)) continue;

      candidates.push(tentative);
    }
  }

  if (candidates.length === 0) {
    return [attrs];
  }

  return candidates.sort((left, right) => {
    if (left.length !== right.length) return left.length - right.length;
    return left.join(',').localeCompare(right.join(','));
  });
}

export function inferFunctionalDependencies(columns: string[], rows: string[][]): FunctionalDependency[] {
  const attrs = uniq(columns);
  if (attrs.length <= 1 || rows.length === 0) return [];

  const indexByAttr = new Map(attrs.map((attr, index) => [attr, index]));
  const found: FunctionalDependency[] = [];

  const combinationBudget = 2500;
  let combinationsChecked = 0;

  const holdsFD = (determinant: string[], dependent: string): boolean => {
    const determinantIndexes = determinant.map((attr) => indexByAttr.get(attr) ?? -1);
    const dependentIndex = indexByAttr.get(dependent) ?? -1;
    if (dependentIndex < 0 || determinantIndexes.some((index) => index < 0)) return false;

    const map = new Map<string, string>();
    for (const row of rows) {
      const determinantKey = stringifyTuple(determinantIndexes.map((index) => row[index] ?? ''));
      const dependentValue = row[dependentIndex] ?? '';
      const existing = map.get(determinantKey);

      if (existing !== undefined && existing !== dependentValue) {
        return false;
      }

      map.set(determinantKey, dependentValue);
    }

    return true;
  };

  outer:
  for (let size = 1; size < attrs.length; size += 1) {
    for (const determinant of combinations(attrs, size)) {
      combinationsChecked += 1;
      if (combinationsChecked > combinationBudget) break outer;

      for (const dependent of attrs) {
        if (determinant.includes(dependent)) continue;
        if (!holdsFD(determinant, dependent)) continue;

        found.push({
          determinant: [...determinant],
          dependent: [dependent],
        });
      }
    }
  }

  if (found.length === 0) return [];

  const scored = found.sort((left, right) => {
    const score = (fd: FunctionalDependency) => {
      const determinantBonus = fd.determinant.reduce((acc, attribute) => acc + (isIdentifierLike(attribute) ? -3 : 0), 0);
      const dependentPenalty = fd.dependent.reduce((acc, attribute) => acc + (isIdentifierLike(attribute) ? 2 : 0), 0);
      return fd.determinant.length * 10 + determinantBonus + dependentPenalty;
    };

    return score(left) - score(right);
  });

  return minimalCover(scored.slice(0, 400));
}

export function inferPrimaryKey(
  columns: string[],
  rows: string[][],
  fds: FunctionalDependency[],
): string[] {
  const attrs = uniq(columns);
  if (attrs.length === 0) return [];

  const scoreKey = (key: string[]) => {
    const idBonus = key.reduce((acc, attr) => acc + (isIdentifierLike(attr) ? 5 : 0), 0);
    const exactIdBonus = key.includes('id') ? 4 : 0;
    return key.length * 100 - idBonus - exactIdBonus;
  };

  if (rows.length > 0) {
    const uniquenessBudget = 2500;
    let checked = 0;
    let best: string[] | null = null;

    outer:
    for (let size = 1; size <= attrs.length; size += 1) {
      for (const key of combinations(attrs, size)) {
        checked += 1;
        if (checked > uniquenessBudget) break outer;

        const seen = new Set<string>();
        let unique = true;

        for (const row of rows) {
          const tuple = stringifyTuple(key.map((attribute) => {
            const index = attrs.indexOf(attribute);
            return row[index] ?? '';
          }));

          if (seen.has(tuple)) {
            unique = false;
            break;
          }
          seen.add(tuple);
        }

        if (!unique) continue;

        const ordered = orderByColumns(key, attrs);
        if (!best || scoreKey(ordered) < scoreKey(best)) {
          best = ordered;
        }
      }
      if (best && best.length === size) break;
    }

    if (best) return best;
  }

  const candidateKeys = findCandidateKeys(attrs, fds);
  if (candidateKeys.length > 0) {
    return [...candidateKeys].sort((left, right) => scoreKey(left) - scoreKey(right))[0];
  }

  const identifierColumns = attrs.filter((attribute) => isIdentifierLike(attribute));
  if (identifierColumns.length > 0) return [identifierColumns[0]];

  return [attrs[0]];
}

export function detectNormalForm(table: TableSchema): NormalForm {
  const source = withResolvedMetadata(table);
  const fds = resolveFDs(source);
  const candidateKeys = resolveCandidateKeys(source, fds);

  if (hasMultiValuedCells(source)) return 'UNF';
  if (getPartialViolations(source, fds, candidateKeys).length > 0) return '1NF';
  if (getTransitiveViolations(source, fds, candidateKeys).length > 0) return '2NF';
  if (getBCNFViolations(source, fds).length > 0) return '3NF';
  if (getMVDViolations(source, fds).length > 0) return 'BCNF';
  if (getJDViolations(source, fds).length > 0) return '4NF';
  return '5NF';
}

export function decomposeTo1NF(table: TableSchema): TableSchema {
  const source = withResolvedMetadata(table);
  if (!source.sampleData || source.sampleData.length === 0) return source;
  if (!hasMultiValuedCells(source)) return source;

  const expandedRows: string[][] = [];

  for (const row of source.sampleData) {
    let rowExpansions: string[][] = [[]];

    for (const cell of row) {
      const pieces = splitMultiValueCell(cell);
      const nextExpansions: string[][] = [];
      for (const partialRow of rowExpansions) {
        for (const piece of pieces) {
          nextExpansions.push([...partialRow, piece]);
        }
      }
      rowExpansions = nextExpansions;

      if (rowExpansions.length > 5000) {
        rowExpansions = rowExpansions.slice(0, 5000);
      }
    }

    expandedRows.push(...rowExpansions);
    if (expandedRows.length > 10000) break;
  }

  const deduped = Array.from(new Set(expandedRows.map((row) => stringifyTuple(row))))
    .map((tuple) => tuple.split(TUPLE_SEPARATOR));

  const fds = resolveFDs(source);
  const primaryKey = inferPrimaryKey(columnNames(source), deduped, fds);

  return {
    ...source,
    sampleData: deduped,
    primaryKey,
    columns: source.columns.map((column) => ({
      ...column,
      isKey: primaryKey.includes(column.name),
    })),
  };
}

export function decomposeTo2NF(tables: TableSchema[]): TableSchema[] {
  const output: TableSchema[] = [];

  for (const rawTable of tables) {
    const table = withResolvedMetadata(rawTable);
    const attrs = columnNames(table);
    if (attrs.length <= 2) {
      output.push(table);
      continue;
    }

    const fds = resolveFDs(table);
    const candidateKeys = resolveCandidateKeys(table, fds);
    const violations = getPartialViolations(table, fds, candidateKeys);

    if (violations.length === 0) {
      output.push(table);
      continue;
    }

    const prime = buildPrimeSet(candidateKeys);
    const grouped = new Map<string, { determinant: string[]; dependents: Set<string> }>();

    for (const violation of violations) {
      const key = setKey(violation.determinant);
      const existing = grouped.get(key);
      if (existing) {
        for (const dependent of violation.dependent) {
          existing.dependents.add(dependent);
        }
      } else {
        grouped.set(key, {
          determinant: [...violation.determinant],
          dependents: new Set(violation.dependent),
        });
      }
    }

    const baseAttrs = new Set(attrs);
    const splits: TableSchema[] = [];
    let splitIndex = 1;

    for (const group of grouped.values()) {
      const dependents = Array.from(group.dependents).filter((dependent) => !prime.has(dependent));
      if (dependents.length === 0) continue;

      const splitAttrs = orderByColumns([...group.determinant, ...dependents], attrs);
      const split = tableFromAttributes(
        table,
        splitAttrs,
        `2nf_${splitIndex}`,
        `${table.name}_${splitIndex}`,
        group.determinant,
      );

      splitIndex += 1;
      splits.push(split);

      for (const dependent of dependents) {
        if (!group.determinant.includes(dependent)) {
          baseAttrs.delete(dependent);
        }
      }
    }

    const base = tableFromAttributes(
      table,
      Array.from(baseAttrs),
      '2nf_base',
      `${table.name}_base`,
      orderByColumns(table.primaryKey.filter((attribute) => baseAttrs.has(attribute)), Array.from(baseAttrs)),
    );

    output.push(base, ...splits);
  }

  return inferForeignKeys(output);
}

export function decomposeTo3NF(tables: TableSchema[]): TableSchema[] {
  const output: TableSchema[] = [];

  for (const rawTable of tables) {
    const table = withResolvedMetadata(rawTable);
    const attrs = columnNames(table);
    if (attrs.length <= 2) {
      output.push(table);
      continue;
    }

    const fds = minimalCover(resolveFDs(table));
    if (fds.length === 0) {
      output.push(table);
      continue;
    }

    const singleton = expandToSingletonFDs(fds);
    const groups = new Map<string, { determinant: string[]; dependents: Set<string> }>();

    for (const fd of singleton) {
      const key = setKey(fd.determinant);
      const existing = groups.get(key);
      if (existing) {
        existing.dependents.add(fd.dependent[0]);
      } else {
        groups.set(key, {
          determinant: [...fd.determinant],
          dependents: new Set(fd.dependent),
        });
      }
    }

    const relations = Array.from(groups.values()).map((group) =>
      orderByColumns([...group.determinant, ...Array.from(group.dependents)], attrs),
    );

    const candidateKeys = resolveCandidateKeys(table, fds);
    const hasKeyRelation = relations.some((relation) => candidateKeys.some((key) => isSubset(key, relation)));

    if (!hasKeyRelation && candidateKeys.length > 0) {
      relations.push(orderByColumns(candidateKeys[0], attrs));
    }

    const minimalRelations = relations.filter((relation, index) =>
      !relations.some((other, otherIndex) => otherIndex !== index && isSubset(relation, other)),
    );

    let relationIndex = 1;
    for (const relation of minimalRelations) {
      const relationFDs = fds.filter((fd) => isSubset(fd.determinant, relation) && isSubset(fd.dependent, relation));
      const primaryKey = relationFDs.length > 0
        ? orderByColumns(relationFDs[0].determinant, relation)
        : inferPrimaryKey(relation, projectRows(table, relation), relationFDs);

      output.push(
        tableFromAttributes(
          {
            ...table,
            fds: relationFDs,
          },
          relation,
          `3nf_${relationIndex}`,
          `${table.name}_${relationIndex}`,
          primaryKey,
        ),
      );
      relationIndex += 1;
    }
  }

  return inferForeignKeys(output);
}

export function decomposeToBCNF(tables: TableSchema[]): TableSchema[] {
  const decomposeOne = (rawTable: TableSchema, depth = 0): TableSchema[] => {
    const table = withResolvedMetadata(rawTable);
    if (depth > 12) return [table];

    const attrs = columnNames(table);
    if (attrs.length <= 2) return [table];

    const fds = resolveFDs(table);
    const violation = getBCNFViolations(table, fds)[0];
    if (!violation) return [table];

    const determinant = violation.determinant;
    const dependent = violation.dependent;

    const leftAttrs = orderByColumns([...determinant, ...dependent], attrs);
    const rightAttrs = orderByColumns(
      attrs.filter((attribute) => determinant.includes(attribute) || !dependent.includes(attribute)),
      attrs,
    );

    if (areSameSet(leftAttrs, attrs) || areSameSet(rightAttrs, attrs)) {
      return [table];
    }

    const left = tableFromAttributes(table, leftAttrs, `bcnf_l_${depth}`, `${table.name}_l`, determinant);
    const rightPrimary = table.primaryKey.filter((attribute) => rightAttrs.includes(attribute));
    const right = tableFromAttributes(
      table,
      rightAttrs,
      `bcnf_r_${depth}`,
      `${table.name}_r`,
      rightPrimary.length > 0 ? rightPrimary : determinant.filter((attribute) => rightAttrs.includes(attribute)),
    );

    return [...decomposeOne(left, depth + 1), ...decomposeOne(right, depth + 1)];
  };

  return inferForeignKeys(tables.flatMap((table) => decomposeOne(table)));
}

export function decomposeTo4NF(tables: TableSchema[]): TableSchema[] {
  const decomposeOne = (rawTable: TableSchema, depth = 0): TableSchema[] => {
    const table = withResolvedMetadata(rawTable);
    if (depth > 12) return [table];

    const attrs = columnNames(table);
    if (attrs.length <= 2) return [table];

    const fds = resolveFDs(table);
    const violation = getMVDViolations(table, fds)[0];
    if (!violation) return [table];

    const determinant = violation.determinant;
    const dependent = violation.dependent;

    const leftAttrs = orderByColumns([...determinant, ...dependent], attrs);
    const rightAttrs = orderByColumns(
      [...determinant, ...attrs.filter((attribute) => !dependent.includes(attribute))],
      attrs,
    );

    if (areSameSet(leftAttrs, attrs) || areSameSet(rightAttrs, attrs)) {
      return [table];
    }

    const left = tableFromAttributes(table, leftAttrs, `4nf_l_${depth}`, `${table.name}_mvd_l`, determinant);
    const right = tableFromAttributes(table, rightAttrs, `4nf_r_${depth}`, `${table.name}_mvd_r`, determinant);

    return [...decomposeOne(left, depth + 1), ...decomposeOne(right, depth + 1)];
  };

  return inferForeignKeys(tables.flatMap((table) => decomposeOne(table)));
}

export function decomposeTo5NF(tables: TableSchema[]): TableSchema[] {
  const output: TableSchema[] = [];

  for (const rawTable of tables) {
    const table = withResolvedMetadata(rawTable);
    const violations = getJDViolations(table, resolveFDs(table));

    if (violations.length === 0 || !table.joinDependencies || table.joinDependencies.length === 0) {
      output.push(table);
      continue;
    }

    const jd = table.joinDependencies.find((candidate) => candidate.components.length >= 3);
    if (!jd) {
      output.push(table);
      continue;
    }

    let index = 1;
    for (const component of jd.components) {
      const attrs = orderByColumns(component, columnNames(table));
      if (attrs.length === 0) continue;
      output.push(
        tableFromAttributes(
          table,
          attrs,
          `5nf_${index}`,
          `${table.name}_jd_${index}`,
          attrs.filter((attribute) => table.primaryKey.includes(attribute)),
        ),
      );
      index += 1;
    }
  }

  return inferForeignKeys(output);
}

function buildStep(
  fromNF: NormalForm,
  toNF: NormalForm,
  inputTables: TableSchema[],
  outputTables: TableSchema[],
): NormalizationStep {
  const violations = inputTables.flatMap((table) => collectViolationsForStep(table, toNF));
  return {
    fromNF,
    toNF,
    inputTables: cloneTables(inputTables),
    outputTables: cloneTables(outputTables),
    explanation: explainTransition(fromNF, toNF, violations, inputTables.length, outputTables.length),
    violationsFound: violations,
    anomalyDemo: anomalyForViolations(violations),
  };
}

function runTransition(currentTables: TableSchema[], toNF: NormalForm): TableSchema[] {
  if (toNF === '1NF') {
    return currentTables.map((table) => decomposeTo1NF(table));
  }
  if (toNF === '2NF') {
    return decomposeTo2NF(currentTables);
  }
  if (toNF === '3NF') {
    return decomposeTo3NF(currentTables);
  }
  if (toNF === 'BCNF') {
    return decomposeToBCNF(currentTables);
  }
  if (toNF === '4NF') {
    return decomposeTo4NF(currentTables);
  }
  return decomposeTo5NF(currentTables);
}

export function normalize(table: TableSchema, targetNF: NormalForm): NormalizationResult {
  const prepared = withResolvedMetadata(table);
  const detectedNF = detectNormalForm(prepared);

  const startIndex = normalFormIndex(detectedNF);
  const targetIndex = normalFormIndex(targetNF);

  let current = [prepared];
  const steps: NormalizationStep[] = [];

  if (startIndex >= 0 && targetIndex >= 0 && targetIndex > startIndex) {
    for (let index = startIndex; index < targetIndex; index += 1) {
      const fromNF = NF_ORDER[index];
      const toNF = NF_ORDER[index + 1];

      const input = cloneTables(current);
      const output = runTransition(current, toNF).map(withResolvedMetadata);

      steps.push(buildStep(fromNF, toNF, input, output));
      current = output;
    }
  }

  return {
    steps,
    detectedNF,
    targetNF,
    originalTable: prepared,
  };
}

function naturalJoin(leftRows: Record<string, string>[], rightRows: Record<string, string>[]): Record<string, string>[] {
  if (leftRows.length === 0 || rightRows.length === 0) return [];

  const leftColumns = Object.keys(leftRows[0]);
  const rightColumns = Object.keys(rightRows[0]);
  const common = leftColumns.filter((column) => rightColumns.includes(column));

  const joined: Record<string, string>[] = [];

  for (const leftRow of leftRows) {
    for (const rightRow of rightRows) {
      const compatible = common.every((column) => (leftRow[column] ?? '') === (rightRow[column] ?? ''));
      if (!compatible) continue;

      joined.push({
        ...leftRow,
        ...rightRow,
      });
    }
  }

  return joined;
}

export function verifyLosslessJoin(original: TableSchema, decomposedTables: TableSchema[]): boolean {
  if (!original.sampleData || original.sampleData.length === 0) {
    return true;
  }

  if (decomposedTables.length === 0) return false;

  const originalAttrs = columnNames(original);
  const originalRows = original.sampleData.map((row) =>
    Object.fromEntries(originalAttrs.map((attribute, index) => [attribute, row[index] ?? ''])),
  );

  const projectedRows = decomposedTables.map((table) => {
    const attrs = columnNames(table);
    const rows = projectRows(original, attrs);
    const unique = Array.from(new Set(rows.map((row) => stringifyTuple(row)))).map((tuple) => tuple.split(TUPLE_SEPARATOR));
    return unique.map((row) => Object.fromEntries(attrs.map((attribute, index) => [attribute, row[index] ?? ''])));
  });

  let reconstructed = projectedRows[0];
  for (let index = 1; index < projectedRows.length; index += 1) {
    reconstructed = naturalJoin(reconstructed, projectedRows[index]);
  }

  const normalizedOriginal = new Set(
    originalRows.map((row) => stringifyTuple(originalAttrs.map((attribute) => row[attribute] ?? ''))),
  );

  const normalizedReconstructed = new Set(
    reconstructed.map((row) => stringifyTuple(originalAttrs.map((attribute) => row[attribute] ?? ''))),
  );

  if (normalizedReconstructed.size !== normalizedOriginal.size) return false;
  for (const tuple of normalizedOriginal) {
    if (!normalizedReconstructed.has(tuple)) return false;
  }

  return true;
}

export function verifyDependencyPreservation(
  originalFDs: FunctionalDependency[],
  decomposedTables: TableSchema[],
): boolean {
  const singletons = expandToSingletonFDs(originalFDs);
  if (singletons.length === 0) return true;

  const projected = minimalCover(decomposedTables.flatMap((table) => table.fds));

  for (const fd of singletons) {
    const closure = attributeClosure(fd.determinant, projected);
    if (!closure.includes(fd.dependent[0])) {
      return false;
    }
  }

  return true;
}
