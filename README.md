# QueryCraft

QueryCraft is a Next.js learning studio for database practice. It combines SQL execution, relational algebra, tuple calculus, ER modeling, normalization, and synthetic dataset generation in one workspace.

The project is mostly client-side, with lightweight API routes for seed datasets and Test DB health/probe checks.

## What Is Implemented

- SQL Sandbox with in-browser SQL execution, schema browser, query history, statement-level results, CSV export, and SQL import.
- Relational Algebra playground with parser, expression tree, step-by-step evaluation, and SQL translation.
- Tuple Relational Calculus workspace with TRC-to-SQL conversion and execution.
- ER Diagram Builder (React Flow) with preset diagrams, PNG export, and ER-to-relational conversion.
- Normalization wizard for FD input, candidate key detection, normal form detection, and decomposition steps.
- Table Generator with semantic hinting and SQL generation using Faker-based values.
- Learn page as a searchable SQL/DBMS reference (DDL, DML, joins, aggregates, set ops, TCL, DCL, routines, and theory sections).
- Device-local account system (local accounts, password check, account export/import).
- Per-account state isolation for all persisted workspaces.

## Architecture Summary

- App framework: Next.js App Router + TypeScript.
- SQL runtime: sql.js (WASM SQLite) in the browser.
- State: Zustand stores, persisted to user-scoped localStorage keys.
- Styling: Tailwind CSS v4 + custom CSS variables and motion.
- Diagrams: @xyflow/react.
- Server routes:
	- `GET /api/datasets` reads JSON files from `seed/datasets`.
	- `GET /api/tests/health` reports Test DB bootstrap/config status.
	- `GET /api/tests/health/probe` runs a live `SELECT 1` connectivity check against Test DB.

## Routes

Public routes:

- `/`
- `/login`
- `/register`

Dashboard routes (client-side auth guard in layout):

- `/dashboard`
- `/learn`
- `/sandbox`
- `/sandbox/history`
- `/algebra`
- `/algebra/history`
- `/tuple-calculus`
- `/tuple-calculus/history`
- `/er-builder`
- `/normalizer`
- `/generator`
- `/settings`

API routes:

- `/api/datasets` (GET)
- `/api/tests/health` (GET)
- `/api/tests/health/probe` (GET)

## Getting Started

Prerequisites:

- Node.js 20+
- npm

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Environment variables:

- None are required for currently shipped browser-first features.
- `TEST_DB_URL` is optional and used for the upcoming Test module backend foundation.

### Use a Free Online Postgres (Recommended: Neon)

You can move Test DB from local Postgres to a free hosted Postgres in a few minutes.

1. Create a free Neon project and database (for example `querycraft_test`).
2. Copy the connection string from Neon dashboard.
3. Set `TEST_DB_URL` in `.env.local`:

```env
TEST_DB_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

4. Apply migrations to the online DB:

```bash
npm run test-db:migrate:status
npm run test-db:migrate
```

5. Verify connectivity:

- `GET /api/tests/health` should report `status: "ready"`
- `GET /api/tests/health/probe` should report `status: "ok"`

## Scripts

- `npm run dev`: start local development server.
- `npm run build`: create production build.
- `npm run start`: run production server.
- `npm run lint`: run ESLint.
- `npm run format`: run Prettier over repository.
- `npm run test`: run Vitest test suite once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test-db:migrate:status`: show Test DB migration status.
- `npm run test-db:migrate`: apply pending Test DB migrations.
- `npm run test-db:migrate:down`: roll back the latest Test DB migration.
- `npm run test-db:migrate:down:all`: roll back all applied Test DB migrations.

## Seed Datasets

Seed files are stored in `seed/datasets` and loaded through `/api/datasets`.

Current bundled datasets:

- `banking.json`
- `credentia.json`
- `university.json`

## Data and Auth Model

- Accounts are device-local. Passwords are SHA-256 hashed in-browser.
- Active session user is stored in sessionStorage.
- Workspace data is persisted in localStorage with user-scoped keys.
- Query execution happens in-browser via sql.js, not against an external database.

This design is intended for learning workflows, not production authentication.

## Tests

The unit suite validates:

- SQL executor behavior (DDL/DML, DCL, TCL, procedures, triggers, cursors, MySQL compatibility, and multi-database behavior).
- Statement splitting and PL/SQL runtime helpers.
- Data generator hint detection/output.
- Session persistence utility behavior.

Run all tests:

```bash
npm run test
```

## Documentation

- `docs/API.md`
- `docs/SECURITY.md`
- `docs/CONTRIBUTING.md`
- `ROADMAP.md`
