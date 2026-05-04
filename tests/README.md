# Tests layout

All Vitest suites live under `tests/`. Subfolders are capped so no single directory holds many unrelated files.

| Area | Path | Notes |
|------|------|--------|
| SQL executor (DDL/DML, splitter, scripts) | `tests/sql/executor/core/` | Core translation and execution |
| Privileges (GRANT/CTE checks) | `tests/sql/executor/privileges/` | Access control |
| Procedures, functions, cursors, triggers | `tests/sql/executor/routines/` | Stored objects |
| Transactions | `tests/sql/executor/transactions/` | TCL |
| Multi-DB / PL/SQL integration | `tests/sql/executor/integration/` | Cross-cutting executor flows |
| PL/SQL runtime | `tests/sql/plsql/` | Block interpreter |
| Normalizer engine | `tests/normalizer/engine/` | Main normalizer |
| Normalizer verification suites | `tests/normalizer/verify/*/` | Grouped by theme (consistency, schema, textbook) |
| App / API / UX helpers | `tests/app/*/` | API routes, data gen, validators, quiz, session, security |

Patterns: `*.test.ts`, `*.test.tsx`. Vitest picks up anything matching `tests/**/*.test.{ts,tsx}`.
