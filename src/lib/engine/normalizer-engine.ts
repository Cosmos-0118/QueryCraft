import type {
  NormalForm,
  FunctionalDependency,
  NormalizerTable,
  DecompositionStep,
  Decomposition,
} from '@/types/normalizer';

// ── Attribute Closure ──
export function attributeClosure(attrs: string[], fds: FunctionalDependency[]): string[] {
  const closure = new Set(attrs);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      if (fd.determinant.every((a) => closure.has(a))) {
        for (const dep of fd.dependent) {
          if (!closure.has(dep)) {
            closure.add(dep);
            changed = true;
          }
        }
      }
    }
  }
  return [...closure].sort();
}

// ── Find all candidate keys ──
export function findCandidateKeys(allAttrs: string[], fds: FunctionalDependency[]): string[][] {
  const keys: string[][] = [];

  // Check all subsets starting from smallest
  const n = allAttrs.length;
  for (let size = 1; size <= n; size++) {
    for (const subset of combinations(allAttrs, size)) {
      const closure = attributeClosure(subset, fds);
      if (allAttrs.every((a) => closure.includes(a))) {
        // Check it's minimal (no proper subset is a superkey)
        const isMinimal = !keys.some(
          (k) => k.length < subset.length && k.every((a) => subset.includes(a)),
        );
        if (isMinimal) {
          // Also check no proper subset of this subset is a superkey
          let subsetIsMinimal = true;
          if (subset.length > 1) {
            for (const smaller of combinations(subset, subset.length - 1)) {
              const sc = attributeClosure(smaller, fds);
              if (allAttrs.every((a) => sc.includes(a))) {
                subsetIsMinimal = false;
                break;
              }
            }
          }
          if (subsetIsMinimal) keys.push(subset);
        }
      }
    }
    if (keys.length > 0) break; // Found minimal keys
  }

  return keys.length > 0 ? keys : [allAttrs];
}

function* combinations(arr: string[], size: number): Generator<string[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= arr.length - size; i++) {
    for (const rest of combinations(arr.slice(i + 1), size - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

// ── Detect Normal Form ──
export function detectNormalForm(
  columns: string[],
  fds: FunctionalDependency[],
  candidateKeys?: string[][],
): NormalForm {
  const keys = candidateKeys ?? findCandidateKeys(columns, fds);
  const primeAttrs = new Set(keys.flat());

  // Check 1NF: assumed if all columns are atomic (structural assumption)
  // Check 2NF: no partial dependency (non-prime attr depends on proper subset of candidate key)
  for (const fd of fds) {
    const closure = attributeClosure(fd.determinant, fds);
    const isSuper = columns.every((a) => closure.includes(a));
    if (isSuper) continue; // Superkey → OK

    for (const dep of fd.dependent) {
      if (primeAttrs.has(dep)) continue; // Prime attr → OK for 2NF
      // Check if determinant is a proper subset of any candidate key
      for (const key of keys) {
        if (fd.determinant.length < key.length && fd.determinant.every((a) => key.includes(a))) {
          return '1NF'; // Partial dependency found
        }
      }
    }
  }

  // Check 3NF: every non-trivial FD either has superkey determinant or dependent is prime
  for (const fd of fds) {
    const closure = attributeClosure(fd.determinant, fds);
    const isSuper = columns.every((a) => closure.includes(a));
    if (isSuper) continue;

    for (const dep of fd.dependent) {
      if (fd.determinant.includes(dep)) continue; // trivial
      if (!primeAttrs.has(dep)) return '2NF'; // Transitive dep on non-prime
    }
  }

  // Check BCNF: every non-trivial FD has a superkey determinant
  for (const fd of fds) {
    const nonTrivialDeps = fd.dependent.filter((d) => !fd.determinant.includes(d));
    if (nonTrivialDeps.length === 0) continue;

    const closure = attributeClosure(fd.determinant, fds);
    const isSuper = columns.every((a) => closure.includes(a));
    if (!isSuper) return '3NF';
  }

  return 'BCNF';
}

// ── Decompose to target NF ──
export function decompose(table: NormalizerTable, targetNF: NormalForm): Decomposition {
  const steps: DecompositionStep[] = [];
  let currentTables: NormalizerTable[] = [table];
  const currentNF = detectNormalForm(table.columns, table.functionalDependencies);

  // Step: show initial state
  steps.push({
    normalForm: currentNF,
    tables: [...currentTables],
    explanation: `Initial table "${table.name}" is in ${currentNF}.`,
  });

  const nfOrder: NormalForm[] = ['UNF', '1NF', '2NF', '3NF', 'BCNF'];
  const currentIdx = nfOrder.indexOf(currentNF);
  const targetIdx = nfOrder.indexOf(targetNF);

  if (targetIdx <= currentIdx) {
    return {
      originalTable: table,
      steps,
      currentNormalForm: currentNF,
      targetNormalForm: targetNF,
    };
  }

  // Decompose to 2NF (remove partial dependencies)
  if (currentIdx < nfOrder.indexOf('2NF') && targetIdx >= nfOrder.indexOf('2NF')) {
    currentTables = decomposeTo2NF(currentTables);
    steps.push({
      normalForm: '2NF',
      tables: [...currentTables],
      explanation:
        'Removed partial dependencies by decomposing tables where non-key attributes depended on part of a composite key.',
      anomalyFixed: 'Partial dependency removed — update anomaly fixed.',
    });
  }

  // Decompose to 3NF (remove transitive dependencies)
  if (nfOrder.indexOf('2NF') < targetIdx && targetIdx >= nfOrder.indexOf('3NF')) {
    currentTables = decomposeTo3NF(currentTables);
    steps.push({
      normalForm: '3NF',
      tables: [...currentTables],
      explanation:
        'Removed transitive dependencies by decomposing tables where non-key attributes depended on other non-key attributes.',
      anomalyFixed: 'Transitive dependency removed — insertion/deletion anomalies fixed.',
    });
  }

  // Decompose to BCNF
  if (nfOrder.indexOf('3NF') < targetIdx) {
    currentTables = decomposeToBCNF(currentTables);
    steps.push({
      normalForm: 'BCNF',
      tables: [...currentTables],
      explanation: 'Every non-trivial functional dependency now has a superkey as its determinant.',
      anomalyFixed: 'All remaining anomalies from non-superkey determinants fixed.',
    });
  }

  const finalNF = targetNF;
  return { originalTable: table, steps, currentNormalForm: finalNF, targetNormalForm: targetNF };
}

function decomposeTo2NF(tables: NormalizerTable[]): NormalizerTable[] {
  const result: NormalizerTable[] = [];
  for (const table of tables) {
    const keys = findCandidateKeys(table.columns, table.functionalDependencies);
    const pk = keys[0];
    if (pk.length <= 1) {
      result.push(table);
      continue;
    }

    const partials: { attrs: string[]; deps: string[] }[] = [];
    const remaining = new Set(table.columns);

    for (const fd of table.functionalDependencies) {
      if (fd.determinant.length < pk.length && fd.determinant.every((a) => pk.includes(a))) {
        const nonTrivial = fd.dependent.filter((d) => !fd.determinant.includes(d));
        if (nonTrivial.length > 0) {
          partials.push({ attrs: fd.determinant, deps: nonTrivial });
          nonTrivial.forEach((d) => remaining.delete(d));
        }
      }
    }

    if (partials.length === 0) {
      result.push(table);
      continue;
    }

    // Main table with remaining columns
    result.push({
      name: table.name,
      columns: [...remaining],
      primaryKey: pk,
      functionalDependencies: table.functionalDependencies.filter((fd) =>
        fd.dependent.every((d) => remaining.has(d)),
      ),
    });

    // New tables for partial dependencies
    for (const partial of partials) {
      const cols = [...partial.attrs, ...partial.deps];
      result.push({
        name: `${table.name}_${partial.deps[0]}`,
        columns: cols,
        primaryKey: partial.attrs,
        functionalDependencies: [{ determinant: partial.attrs, dependent: partial.deps }],
      });
    }
  }
  return result;
}

function decomposeTo3NF(tables: NormalizerTable[]): NormalizerTable[] {
  const result: NormalizerTable[] = [];
  for (const table of tables) {
    const keys = findCandidateKeys(table.columns, table.functionalDependencies);
    const primeAttrs = new Set(keys.flat());
    const transitives: { det: string[]; deps: string[] }[] = [];
    const remaining = new Set(table.columns);

    for (const fd of table.functionalDependencies) {
      const closure = attributeClosure(fd.determinant, table.functionalDependencies);
      const isSuper = table.columns.every((a) => closure.includes(a));
      if (isSuper) continue;

      const nonTrivial = fd.dependent.filter(
        (d) => !fd.determinant.includes(d) && !primeAttrs.has(d),
      );
      if (nonTrivial.length > 0) {
        transitives.push({ det: fd.determinant, deps: nonTrivial });
        nonTrivial.forEach((d) => remaining.delete(d));
      }
    }

    if (transitives.length === 0) {
      result.push(table);
      continue;
    }

    result.push({
      name: table.name,
      columns: [...remaining],
      primaryKey: keys[0],
      functionalDependencies: table.functionalDependencies.filter((fd) =>
        fd.dependent.every((d) => remaining.has(d)),
      ),
    });

    for (const trans of transitives) {
      const cols = [...trans.det, ...trans.deps];
      result.push({
        name: `${table.name}_${trans.deps[0]}`,
        columns: cols,
        primaryKey: trans.det,
        functionalDependencies: [{ determinant: trans.det, dependent: trans.deps }],
      });
    }
  }
  return result;
}

function decomposeToBCNF(tables: NormalizerTable[]): NormalizerTable[] {
  const result: NormalizerTable[] = [];

  for (const table of tables) {
    let decomposed = false;
    for (const fd of table.functionalDependencies) {
      const nonTrivial = fd.dependent.filter((d) => !fd.determinant.includes(d));
      if (nonTrivial.length === 0) continue;

      const closure = attributeClosure(fd.determinant, table.functionalDependencies);
      const isSuper = table.columns.every((a) => closure.includes(a));
      if (isSuper) continue;

      // Decompose: R1 = closure(fd.determinant), R2 = fd.determinant + (R - nonTrivial)
      const r1Cols = [...new Set([...fd.determinant, ...nonTrivial])];
      const r2Cols = table.columns.filter((c) => !nonTrivial.includes(c));

      const t1: NormalizerTable = {
        name: `${table.name}_${nonTrivial[0]}`,
        columns: r1Cols,
        primaryKey: fd.determinant,
        functionalDependencies: [{ determinant: fd.determinant, dependent: nonTrivial }],
      };
      const t2: NormalizerTable = {
        name: table.name,
        columns: r2Cols,
        primaryKey: findCandidateKeys(
          r2Cols,
          table.functionalDependencies.filter(
            (f) =>
              f.determinant.every((a) => r2Cols.includes(a)) &&
              f.dependent.every((a) => r2Cols.includes(a)),
          ),
        )[0],
        functionalDependencies: table.functionalDependencies.filter(
          (f) =>
            f.determinant.every((a) => r2Cols.includes(a)) &&
            f.dependent.every((a) => r2Cols.includes(a)),
        ),
      };

      result.push(...decomposeToBCNF([t1, t2]));
      decomposed = true;
      break;
    }
    if (!decomposed) result.push(table);
  }
  return result;
}
