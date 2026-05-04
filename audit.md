# MySQL Sandbox Re-Audit Report (Pass 3)

Date: 2026-05-04
Scope: QueryCraft SQL sandbox authorization, lexer-driven privilege target extraction, and newly modularized command handlers.

## Overall Rating
 
**9.2 / 10**

This pass resolves the two highest-severity authorization gaps from Pass 2. The privilege model now tracks both mutation targets and read-side sources (including CTE bodies), and focused regression tests pass.

## Verification Snapshot

- Static re-review of:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
  - [src/lib/engine/sql-executor/internal/alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts)
  - [src/lib/engine/sql-executor/internal/database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts)
  - [tests/sql/executor/privileges/sql-executor-dcl.test.ts](tests/sql/executor/privileges/sql-executor-dcl.test.ts)
- Regression run:
  - `npm test -- tests/sql/executor/privileges/sql-executor-dcl.test.ts`
  - Result: 1 file, 10 tests passed.

## Findings (Ordered by Criticality)

## 1) Low: Lexer-based SQL modeling still has bounded dialect coverage

**Evidence**
- Privilege derivation is implemented via custom token parsing and clause walkers in:
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
- Authorization hard-denies or allows based on derived targets:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)

**Impact**
- As SQL shape complexity grows (dialect edge cases, uncommon syntactic forms), parser drift risk remains.
- Current implementation appears secure for covered cases, but untested syntactic variants can still produce false deny/allow behavior.

**Recommendation**
- Keep the current deny-by-default fallback and grow coverage with grammar-edge regression tests (nested CTEs, exotic JOIN/DELETE forms, quoted/qualified aliases, and deeply nested derived tables).

---

## 2) Low: ALTER TABLE compatibility rebuild path can diverge from native engine semantics

**Evidence**
- Compatibility layer reconstructs tables for several ALTER operations:
  - [src/lib/engine/sql-executor/internal/alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)

**Impact**
- Rebuild-based emulation can differ from full MySQL behavior around indexes/constraints/default expressions in edge migrations.
- This is primarily a compatibility correctness risk, not a direct authorization bypass.

**Recommendation**
- Add targeted migration tests for index metadata preservation and column-definition roundtrips across chained ALTER statements.

## Resolved Since Previous Pass

- CTE body references are now included in privilege derivation:
  - `collectCteBodyReadReferences(...)` in [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
- Mixed-verb statements now derive per-table privileges (e.g., `INSERT` + `SELECT` targets):
  - `extractPrivilegeTableTargets(...)` in [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
  - `extractPrivilegeTargets(...)` in [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)
- Regression tests now cover:
  - CTE-based DML with missing source-table `SELECT`
  - `INSERT ... SELECT` requiring source-table `SELECT`
  - [tests/sql/executor/privileges/sql-executor-dcl.test.ts](tests/sql/executor/privileges/sql-executor-dcl.test.ts)
- `SqlExecutor` command handling was split into dedicated internal modules, reducing central complexity:
  - [src/lib/engine/sql-executor/internal/database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts)
  - [src/lib/engine/sql-executor/internal/alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts)

## Final Assessment

The engine is now in a materially stronger and more predictable state than Pass 2, with the prior authorization bypass paths closed and validated by tests. Remaining risk is mostly long-tail SQL-shape coverage, best handled through additional regression cases rather than architectural rework.
