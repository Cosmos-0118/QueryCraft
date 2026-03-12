# QueryCraft

An interactive, browser-based platform for learning database concepts — SQL, relational algebra, ER diagrams, and normalization — with step-by-step visual execution. Everything runs client-side; no server or database required.

## Features

- **SQL Sandbox** — Write and execute SQL in-browser using sql.js (WebAssembly SQLite). Schema browser, query history, CSV export.
- **Relational Algebra** — Parse, visualize, and evaluate expressions (σ, π, ⋈, ∪, −, ×, ρ) with animated step-through and algebra-to-SQL conversion.
- **ER Diagram Builder** — Drag-and-drop entity-relationship diagrams with React Flow. Auto-convert ER models to relational tables.
- **Normalization Wizard** — Input functional dependencies, detect normal forms (1NF–5NF), and watch step-by-step decomposition with anomaly demos.
- **Table Generator** — Define schemas and generate realistic data using 40+ semantic patterns (names, emails, GPAs, salaries, etc.) powered by Faker.js.
- **SQL Reference** — Searchable command reference covering DDL, DML, constraints, joins, subqueries, set operations, PL/SQL, DCL, relational algebra, and normalization.

## Tech Stack

| Layer     | Technology                             |
| --------- | -------------------------------------- |
| Framework | Next.js (App Router, TypeScript)       |
| Styling   | Tailwind CSS, shadcn/ui, Framer Motion |
| SQL       | sql.js (WASM — in-browser SQLite)      |
| Diagrams  | React Flow (@xyflow/react)             |
| Editor    | CodeMirror 6                           |
| State     | Zustand (persisted to localStorage)    |
| Data Gen  | @faker-js/faker                        |

## Getting Started

```bash
git clone https://github.com/Cosmos-0118/QueryCraft.git
cd QueryCraft
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables needed.

## Deployment

Deploy as a static-capable Next.js app on [Vercel](https://vercel.com) (recommended) or any platform that supports Next.js. No server-side resources required.

## License

MIT
