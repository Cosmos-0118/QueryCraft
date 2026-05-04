# MySQL Sandbox Re-Audit Report (Pass 2)

Date: 2026-05-04
Scope: QueryCraft SQL sandbox engine authorization model, lexer-based table extraction, MySQL compatibility transforms, and regression behavior.

## Overall Rating

**8.4 / 10**

The latest hardening pass fixed the previous critical verb-classification flaw and closed multiple compatibility gaps. Remaining risk is concentrated in privilege-target modeling for CTE and mixed-verb statements.

## Verification Snapshot

- Static re-review of:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)
  - [src/lib/engine/sql-error-engine.ts](src/lib/engine/sql-error-engine.ts)
- Regression run:
  - `npm test -- tests/unit/sql-executor*.test.ts tests/unit/sql-splitter.test.ts tests/unit/plsql-runtime.test.ts`
  - Result: 13 test files, 97 tests passed.
- Focused ad-hoc probes (temporary tests, not committed):
  - Probe A: non-CTE `DELETE ... (SELECT ... FROM secret)` was denied, while CTE-equivalent `WITH src AS (SELECT ... FROM secret) DELETE ...` was allowed under the same grants.
  - Probe B: `INSERT INTO sink SELECT ... FROM secret` succeeded with only `INSERT` grants (no `SELECT` grants) when `INSERT` existed on both source and target tables.

## Findings (Ordered by Criticality)

## 1) High: CTE source tables are skipped by privilege target extraction

**Evidence**
- CTE parsing computes a post-CTE start index:
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L373)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L410)
- Reference extraction for privilege targets scans from that start index:
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L564)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L566)
- Authorization uses these extracted references directly:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1258)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1290)

**Impact**
- Tables referenced only inside CTE definitions can evade table-level privilege checks.
- Equivalent non-CTE forms may be denied while CTE forms are allowed, creating an authorization bypass by query shape.

**Recommendation**
- Extend table-reference extraction to include CTE body references, while still excluding CTE alias names as physical tables.
- Add regression tests for CTE-based DELETE/UPDATE/INSERT with unauthorized CTE source tables.

---

## 2) Medium: Single-verb privilege mapping causes mixed-verb authorization drift

**Evidence**
- Statement privilege is resolved to one verb for the whole SQL statement:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1207)
- That one privilege is applied to every extracted table target:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1287)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1290)

**Impact**
- Mixed-verb statements such as `INSERT ... SELECT` can execute without `SELECT` privilege if write-verb grants align with current checks.
- This diverges from MySQL privilege semantics and can permit read-side access through write-oriented grants.

**Recommendation**
- Move to clause-aware privilege derivation per table reference:
  - `INSERT` on target table(s), `SELECT` on source tables.
  - `UPDATE`/`DELETE` on mutation targets and `SELECT` on read-side subqueries/joins as needed.

## Resolved Since Previous Pass

- CTE-prefixed DML verb classification now uses lexer-aware leading-verb extraction:
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L535)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1207)
  - [tests/unit/sql-executor-dcl.test.ts](tests/unit/sql-executor-dcl.test.ts#L88)
- Unsupported-feature top-level error now includes specific raw reason context:
  - [src/lib/engine/sql-error-engine.ts](src/lib/engine/sql-error-engine.ts#L250)
- CREATE TRIGGER header parsing now handles quoted identifiers via structured parsing:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L134)
  - [tests/unit/sql-executor-triggers.test.ts](tests/unit/sql-executor-triggers.test.ts#L103)
- CONCAT compatibility rewrite now supports nested calls:
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L192)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L788)
  - [tests/unit/sql-executor-compatibility.test.ts](tests/unit/sql-executor-compatibility.test.ts#L57)

## Final Assessment

The engine is materially stronger than the previous pass and currently stable under its regression suite. The highest-priority next step is a second authorization-model refinement focused on CTE source table accounting and mixed-verb privilege semantics.
