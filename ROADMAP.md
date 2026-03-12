# QueryCraft — ROADMAP

> **QueryCraft** is an interactive, visual DBMS learning platform that teaches students database concepts by showing — not just telling. Students watch tables form, queries execute, rows highlight, and schemas transform in real time.

---

## Table of Contents

1. [Vision & Concept](#1-vision--concept)
2. [Core Features](#2-core-features)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [File Structure](#5-file-structure)
6. [Syllabus Coverage Map](#6-syllabus-coverage-map)
7. [Sample Datasets](#7-sample-datasets)
8. [Development Phases](#8-development-phases)
9. [Future Enhancements](#9-future-enhancements)

---

## 1. Vision & Concept

### The Problem

Students learning DBMS typically study theory from textbooks and run blind SQL commands in a terminal. They never **see** what a JOIN actually does to two tables, how normalization decomposes a table step by step, or how relational algebra maps to real operations.

### The Solution — QueryCraft

A web platform with **two primary modes**:

| Mode             | Description                                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guided Mode**  | Student picks a topic (e.g., "Relational Algebra — Selection"). The system auto-creates tables with sample data, executes operations step by step, and visually highlights every change: rows added, removed, columns projected, tables joined — all animated. |
| **Sandbox Mode** | Student freely creates tables (auto-generated or manual data), writes SQL/relational algebra, and sees instant visual results. Like a visual SQL playground.                                                                                                   |

### What Makes It Click

- **Before/After Table Diffs** — Every operation shows the table before and after, with highlighted changes (green for added rows, red for removed, yellow for modified).
- **Step-by-Step Execution** — Complex queries broken into atomic visual steps. A JOIN shows: (1) both tables, (2) matching condition highlighted, (3) combined result.
- **ER Diagram Builder** — Drag-and-drop entities, relationships, attributes. Auto-converts to relational tables.
- **Normalization Wizard** — Feed in a table with functional dependencies. Watch it decompose: 1NF → 2NF → 3NF → BCNF, with anomalies demonstrated at each stage.
- **Session Persistence** — Close the browser, come back tomorrow, continue exactly where you left off.

---

## 2. Core Features

### 2.1 Authentication & Accounts

- Email/password registration and login
- Client-side password hashing (SHA-256 via Web Crypto API)
- All account data stored in localStorage (no server required)

### 2.2 Guided Learning Engine

- Pre-built lessons for all 5 DBMS units
- Each lesson = a sequence of **steps**
- Each step has: explanation text, SQL/algebra command, before-state, after-state, visual diff
- Playback controls: Play (auto-advance), Pause, Previous, Next, Restart
- Speed control for auto-play (0.5x, 1x, 2x)

### 2.3 SQL Sandbox

- In-browser SQL engine via **sql.js** (SQLite compiled to WebAssembly)
- Zero server load for query execution — everything runs client-side
- Syntax-highlighted editor with autocomplete (keywords, table names, column names)
- Schema browser sidebar showing all current tables and their structure
- Query history with re-run capability
- Auto-generate sample data using Faker.js, or enter manually
- Export results as CSV

### 2.4 Relational Algebra Playground

- Custom parser/executor for relational algebra expressions
- Symbol palette for easy input: σ (selection), π (projection), ⋈ (join), ∪ (union), − (difference), × (cartesian product), ρ (rename)
- Expression tree visualization — shows the operation tree
- Step-by-step evaluation — intermediate results at each node
- Side-by-side comparison: relational algebra ↔ equivalent SQL

### 2.5 ER Diagram Builder

- Drag-and-drop canvas using React Flow
- Node types: Entity (rectangle), Weak Entity (double rectangle), Relationship (diamond), Attribute (oval), Key Attribute (underlined oval), Multivalued (double oval), Derived (dashed oval)
- Cardinality labels on edges (1:1, 1:N, M:N)
- Auto-convert ER diagram → Relational schema (with table generation)
- Pre-built case study ER diagrams (University, Banking, E-commerce)

### 2.6 Normalization Wizard

- Input: a table with columns and functional dependencies
- Detects current normal form (UNF/1NF/2NF/3NF/BCNF/4NF/5NF)
- Step-by-step decomposition with visual animations
- At each stage, demonstrates the anomaly that the normal form fixes (insert, update, delete anomalies)
- Shows the dependency diagram at each level

### 2.7 Session Management

- Resume-from-where-you-left-off for every lesson and sandbox
- Sandbox state persistence (tables, data, query history)

---

## 3. Tech Stack

| Layer                  | Technology                          | Why                                                         |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------- |
| **Framework**          | Next.js (App Router, TypeScript)    | File-based routing, excellent DX                            |
| **UI Library**         | Tailwind CSS + shadcn/ui            | Clean, accessible, customizable components                  |
| **Animations**         | Framer Motion                       | Smooth table transitions, step animations                   |
| **Diagrams**           | React Flow (@xyflow/react)          | Battle-tested library for node-based ER diagrams            |
| **SQL Editor**         | CodeMirror 6                        | Lightweight, extensible, syntax highlighting + autocomplete |
| **Client SQL Engine**  | sql.js (SQLite WASM)                | Execute SQL in-browser, zero server cost, instant results   |
| **State Management**   | Zustand (persisted to localStorage) | Minimal boilerplate, great for sandbox state                |
| **Forms & Validation** | React Hook Form + Zod               | Type-safe client-side validation                            |
| **Fake Data**          | @faker-js/faker                     | Generate realistic sample data for tables                   |
| **Testing**            | Vitest                              | Unit tests                                                  |
| **Deployment**         | Vercel                              | Native Next.js support, global CDN                          |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │  Guided  │  │  SQL     │  │  ER      │  │ Normalization │    │
│  │  Lessons │  │  Sandbox │  │  Builder │  │ Wizard        │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘    │
│       │              │             │               │            │
│  ┌────▼──────────────▼─────────────▼───────────────▼────────┐   │
│  │              Visual Engine (Framer Motion)               │   │
│  │   table-viewer · table-diff · step-navigator · timeline  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │              Computation Engines (Client-Side)           │   │
│  │   sql.js (WASM)  ·  algebra-engine  ·  normalizer-engine │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Persistence (localStorage via Zustand)      │   │
│  │   auth · sandbox · lessons · algebra · normalizer · ER   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Architecture Decision:** The entire application runs **client-side**. This means:

- SQL execution via sql.js (SQLite in WebAssembly) — no server needed
- No network round-trips for queries — instant execution
- Each student gets a fully isolated environment
- All state (auth, sessions, progress) persisted to localStorage
- No database, no API routes, no environment variables required

---

## 5. File Structure

```
QueryCraft/
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── og-image.png                         # Social preview image
│
├── src/
│   ├── app/                                  # ── Next.js App Router ──
│   │   ├── layout.tsx                        # Root layout (providers, fonts, theme)
│   │   ├── page.tsx                          # Landing page (hero, features, CTA)
│   │   ├── globals.css                       # Tailwind base + custom animations
│   │   ├── not-found.tsx                     # Custom 404 page
│   │   │
│   │   ├── (auth)/                           # ── Auth Pages (public) ──
│   │   │   ├── layout.tsx                    # Centered card layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx                  # Login form
│   │   │   └── register/
│   │   │       └── page.tsx                  # Registration form
│   │   │
│   │   ├── (dashboard)/                      # ── Protected Pages ──
│   │   │   ├── layout.tsx                    # Sidebar + header layout, auth guard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                  # Home dashboard (quick actions)
│   │   │   │
│   │   │   ├── learn/                        # ── Guided Learning ──
│   │   │   │   ├── page.tsx                  # Unit/topic selection grid
│   │   │   │   └── [topicSlug]/
│   │   │   │       ├── page.tsx              # Topic overview + lesson list
│   │   │   │       └── [lessonSlug]/
│   │   │   │           └── page.tsx          # Interactive lesson player
│   │   │   │
│   │   │   ├── sandbox/                      # ── SQL Sandbox ──
│   │   │   │   └── page.tsx                  # SQL editor + results + schema browser
│   │   │   │
│   │   │   ├── algebra/                      # ── Relational Algebra Playground ──
│   │   │   │   └── page.tsx                  # Algebra expression input + visual evaluator
│   │   │   │
│   │   │   ├── er-builder/                   # ── ER Diagram Builder ──
│   │   │   │   └── page.tsx                  # Drag-and-drop ER canvas + export
│   │   │   │
│   │   │   ├── normalizer/                   # ── Normalization Wizard ──
│   │   │   │   └── page.tsx                  # FD input + step-by-step decomposition
│   │   │   │
│   │   │   └── settings/                     # ── User Settings ──
│   │   │       └── page.tsx                  # Profile, password change, theme, data export
│   │
│   ├── components/                           # ── React Components ──
│   │   ├── ui/                               # shadcn/ui primitives (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   └── tooltip.tsx
│   │   │
│   │   ├── layout/                           # App shell components
│   │   │   ├── header.tsx                    # Top bar: logo, user menu, theme toggle
│   │   │   ├── sidebar.tsx                   # Navigation sidebar (units, tools)
│   │   │   ├── mobile-nav.tsx                # Bottom sheet nav for mobile
│   │   │   └── breadcrumbs.tsx               # Breadcrumb navigation
│   │   │
│   │   ├── auth/                             # Auth-related forms
│   │   │   ├── login-form.tsx
│   │   │   └── register-form.tsx
│   │   │
│   │   ├── visualizer/                       # ── Core Visual Components ──
│   │   │   ├── table-viewer.tsx              # Renders a database table as a styled grid
│   │   │   ├── table-diff.tsx                # Side-by-side or overlay before/after diff
│   │   │   ├── row-highlight.tsx             # Highlights specific rows (added/removed/matched)
│   │   │   ├── column-highlight.tsx          # Highlights specific columns (projected)
│   │   │   ├── query-display.tsx             # Syntax-highlighted SQL/algebra display
│   │   │   ├── step-navigator.tsx            # Playback controls (prev/play/pause/next/speed)
│   │   │   ├── execution-timeline.tsx        # Horizontal timeline of all steps
│   │   │   ├── explanation-panel.tsx         # Text explanation for current step
│   │   │   └── result-panel.tsx              # Final query result display
│   │   │
│   │   ├── er-diagram/                       # ── ER Diagram Components ──
│   │   │   ├── er-canvas.tsx                 # React Flow canvas wrapper
│   │   │   ├── entity-node.tsx               # Rectangle entity node
│   │   │   ├── weak-entity-node.tsx          # Double-border entity node
│   │   │   ├── relationship-node.tsx         # Diamond-shaped relationship node
│   │   │   ├── attribute-node.tsx            # Oval attribute node (with key/multivalued variants)
│   │   │   ├── cardinality-edge.tsx          # Edge with 1:1, 1:N, M:N labels
│   │   │   └── er-toolbar.tsx                # Toolbar: add entity, relationship, export
│   │   │
│   │   ├── algebra/                          # ── Relational Algebra Components ──
│   │   │   ├── algebra-input.tsx             # Expression input with symbol insertion
│   │   │   ├── symbol-palette.tsx            # Clickable symbols: σ π ⋈ ∪ − × ρ
│   │   │   ├── expression-tree.tsx           # Tree visualization of parsed expression
│   │   │   ├── intermediate-result.tsx       # Table result at a tree node
│   │   │   └── algebra-to-sql.tsx            # Shows equivalent SQL query
│   │   │
│   │   ├── normalizer/                       # ── Normalization Components ──
│   │   │   ├── fd-input.tsx                  # Functional dependency input (A,B → C)
│   │   │   ├── normal-form-badge.tsx         # Badge showing current NF level
│   │   │   ├── decomposition-stepper.tsx     # Step-through decomposition animation
│   │   │   ├── dependency-diagram.tsx        # Visual FD arrows on table columns
│   │   │   └── anomaly-demo.tsx              # Interactive anomaly demonstration
│   │   │
│   │   ├── sandbox/                          # ── SQL Sandbox Components ──
│   │   │   ├── sql-editor.tsx                # CodeMirror editor with SQL highlighting
│   │   │   ├── schema-browser.tsx            # Sidebar: current tables, columns, types
│   │   │   └── query-history.tsx             # Scrollable list of past queries
│   │   │
│   │   ├── dashboard/                        # ── Dashboard Components ──
│   │   │   └── quick-actions.tsx             # Shortcut buttons to tools
│   │   │
│   │   └── shared/                           # ── Shared/Utility Components ──
│   │       ├── loading.tsx                   # Spinner/skeleton loader
│   │       ├── error-boundary.tsx            # React error boundary
│   │       ├── theme-toggle.tsx              # Dark/light mode switch
│   │       ├── confirm-dialog.tsx            # Reusable confirmation dialog
│   │       └── empty-state.tsx               # Empty state illustrations
│   │
│   ├── lib/                                  # ── Core Libraries & Business Logic ──
│   │   ├── engine/                           # ── Computation Engines (client-importable) ──
│   │   │   ├── sql-executor.ts               # sql.js wrapper: init WASM, exec query, get tables
│   │   │   ├── algebra-parser.ts             # Tokenizer + parser for relational algebra syntax
│   │   │   ├── algebra-evaluator.ts          # Evaluates parsed algebra tree against in-memory tables
│   │   │   ├── normalizer-engine.ts          # Computes FD closure, candidate keys, NF detection, decomposition
│   │   │   ├── er-to-relational.ts           # Converts ER diagram JSON → relational schema
│   │   │   └── data-generator.ts             # Generates fake data using Faker.js for any schema
│   │   │
│   │   ├── lessons/                          # ── Guided Lesson Infrastructure ──
│   │   │   ├── lesson-runner.ts              # Orchestrator: loads lesson, manages step state
│   │   │   ├── step-builder.ts               # Builds visual steps from lesson definitions
│   │   │   └── content/                      # ── Lesson Content (per unit) ──
│   │   │       ├── index.ts                  # Lesson registry: all topics + metadata
│   │   │       ├── unit1/
│   │   │       │   ├── intro-to-dbms.ts      # File systems vs DBMS, basic terms
│   │   │       │   ├── data-models.ts        # Hierarchical, network, relational, OO models
│   │   │       │   ├── three-level-arch.ts   # External/conceptual/internal architecture
│   │   │       │   └── er-diagrams.ts        # ER basics, extensions, case studies
│   │   │       ├── unit2/
│   │   │       │   ├── er-to-relational.ts   # ER → table conversion with examples
│   │   │       │   ├── relational-algebra.ts # σ, π, ⋈, ∪, −, ×, ρ with step-by-step demos
│   │   │       │   └── relational-calculus.ts# TRC vs DRC explanation
│   │   │       ├── unit3/
│   │   │       │   ├── ddl-commands.ts       # CREATE, ALTER, DROP with visual table changes
│   │   │       │   ├── dml-commands.ts       # INSERT, UPDATE, DELETE with row highlights
│   │   │       │   ├── select-queries.ts     # SELECT, WHERE, ORDER BY, GROUP BY, HAVING
│   │   │       │   ├── constraints.ts        # NOT NULL, UNIQUE, PK, FK, CHECK, DEFAULT
│   │   │       │   ├── joins.ts              # INNER, LEFT, RIGHT, FULL, CROSS — animated
│   │   │       │   ├── set-operations.ts     # UNION, INTERSECT, MINUS
│   │   │       │   ├── subqueries-views.ts   # Subqueries + CREATE VIEW
│   │   │       │   ├── plsql.ts              # Stored procedures, blocks
│   │   │       │   └── triggers-cursors.ts   # Trigger creation, cursor walkthrough
│   │   │       ├── unit4/
│   │   │       │   ├── why-normalize.ts      # Anomalies demo with real data
│   │   │       │   ├── first-nf.ts           # Atomic values, removing repeating groups
│   │   │       │   ├── second-nf.ts          # Removing partial dependencies
│   │   │       │   ├── third-nf.ts           # Removing transitive dependencies
│   │   │       │   ├── bcnf.ts               # Boyce-Codd normal form
│   │   │       │   └── fourth-fifth-nf.ts    # 4NF (multivalued), 5NF (join dependencies)
│   │   │       └── unit5/
│   │   │           ├── transactions.ts       # ACID properties, COMMIT/ROLLBACK demo
│   │   │           ├── concurrency.ts        # Lost update, dirty read, phantom — visualized
│   │   │           └── nosql-intro.ts        # Document, key-value, column, graph overview
│   │   │
│   │   └── utils/                            # General utilities
│   │       ├── constants.ts                  # App-wide constants
│   │       ├── validators.ts                 # Zod schemas (auth, etc.)
│   │       └── helpers.ts                    # Misc shared helpers
│   │
│   ├── hooks/                                # ── Custom React Hooks ──
│   │   ├── use-auth.ts                       # Auth state, login/logout/register actions
│   │   ├── use-sql-engine.ts                 # Initialize sql.js, execute queries
│   │   ├── use-lesson.ts                     # Lesson playback state and controls
│   │   ├── use-session-persistence.ts        # Auto-save and restore sandbox/lesson state
│   │   └── use-debounce.ts                   # Debounce utility hook
│   │
│   ├── stores/                               # ── Zustand Stores (all persisted to localStorage) ──
│   │   ├── auth-store.ts                     # Client-side auth (SHA-256, localStorage)
│   │   ├── sandbox-store.ts                  # Current tables, query, results, history
│   │   ├── lesson-store.ts                   # Current lesson, step index, playback state
│   │   ├── algebra-store.ts                  # Current expression, tree, evaluation state
│   │   ├── normalizer-store.ts               # Table, FDs, current NF, decomposition steps
│   │   ├── generator-store.ts                # Table generator definitions and state
│   │   ├── er-store.ts                       # ER diagram nodes, edges, diagram state
│   │   └── theme-store.ts                    # Dark/light mode preference
│   │
│   ├── types/                                # ── TypeScript Type Definitions ──
│   │   ├── auth.ts                           # User, LoginRequest, RegisterRequest, TokenPair
│   │   ├── lesson.ts                         # Lesson, Step, LessonMeta, StepType
│   │   ├── algebra.ts                        # AlgebraExpression, AlgebraNode, Operation
│   │   ├── er-diagram.ts                     # Entity, Relationship, Attribute, ERDiagram
│   │   ├── normalizer.ts                     # FunctionalDependency, NormalForm, Decomposition
│   │   └── database.ts                       # TableSchema, Column, Row, QueryResult
│   │
│   └── styles/
│       └── animations.css                    # Custom keyframe animations for table transitions
│
├── seed/                                     # ── Seed Data & Datasets ──
│   └── datasets/
│       ├── university.json                   # Students, courses, enrollments, departments
│       └── banking.json                      # Accounts, transactions, branches, customers
├── tests/                                    # ── Test Suite ──
│   └── unit/
│       ├── session-persistence.test.ts
│       └── validators.test.ts
│
├── docs/                                     # ── Documentation ──
│   ├── SECURITY.md                           # Security model documentation
│   ├── API.md                                # API endpoint documentation
│   └── CONTRIBUTING.md                       # Contribution guidelines
│
├── .eslintrc.json
├── .gitignore
├── next.config.ts                            # Next.js configuration
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts                          # Vitest test configuration
├── ROADMAP.md                                # ← You are here
└── README.md
```

---

## 6. Syllabus Coverage Map

Shows how each syllabus topic maps to a QueryCraft feature:

| Unit | Topic                                       | Feature                               | Interaction Type                    |
| ---- | ------------------------------------------- | ------------------------------------- | ----------------------------------- |
| 1    | File Processing → DBMS                      | Guided lesson                         | Animated comparison                 |
| 1    | Terminologies (table, tuple, attribute...)  | Guided lesson                         | Interactive glossary                |
| 1    | 3-Level Architecture                        | Guided lesson                         | Layered diagram animation           |
| 1    | Data Models                                 | Guided lesson                         | Side-by-side model comparison       |
| 1    | ER Diagrams                                 | **ER Builder**                        | Drag-and-drop + auto-convert        |
| 1    | ER Extensions (weak entity, specialization) | **ER Builder**                        | Node type selection                 |
| 1    | Case Studies (University, Banking)          | Guided lesson + **ER Builder**        | Pre-built ER diagrams               |
| 2    | ER to Relational Mapping                    | **ER Builder** → auto-generate tables | One-click conversion                |
| 2    | Design Issues                               | Guided lesson                         | Visual anomaly examples             |
| 2    | TRC / DRC                                   | Guided lesson                         | Expression → result demo            |
| 2    | Relational Algebra (σ, π, ⋈, ∪, −, ×, ρ)    | **Algebra Playground**                | Step-by-step visual evaluation      |
| 2    | Algebra Joins (Theta, Equi, Natural)        | **Algebra Playground**                | Animated join matching              |
| 3    | DDL (CREATE, ALTER, DROP)                   | **SQL Sandbox** + Guided              | Schema changes visualized           |
| 3    | DML (INSERT, UPDATE, DELETE)                | **SQL Sandbox** + Guided              | Row-level diff highlighting         |
| 3    | SELECT queries                              | **SQL Sandbox** + Guided              | Result highlighting                 |
| 3    | Constraints (PK, FK, NOT NULL...)           | Guided lesson                         | Constraint violation demos          |
| 3    | Joins                                       | **SQL Sandbox** + Guided              | Animated row matching               |
| 3    | Set Operations (UNION, INTERSECT, MINUS)    | **SQL Sandbox** + Guided              | Venn diagram + result table         |
| 3    | Subqueries & Views                          | **SQL Sandbox** + Guided              | Inner query → outer query flow      |
| 3    | PL/SQL, Triggers, Cursors                   | Guided lesson                         | Step-by-step procedure trace        |
| 4    | Anomalies (Insert, Update, Delete)          | **Normalizer**                        | Interactive anomaly demos           |
| 4    | 1NF → 2NF → 3NF → BCNF → 4NF → 5NF          | **Normalizer**                        | Step-by-step decomposition          |
| 5    | ACID Properties                             | Guided lesson                         | Transaction simulation              |
| 5    | Concurrency Issues                          | Guided lesson                         | Two-user parallel timeline          |
| 5    | Recovery Algorithms                         | Guided lesson                         | Log-based recovery animation        |
| 5    | NoSQL Overview                              | Guided lesson                         | Document/KV/Column/Graph comparison |

---

## 7. Sample Datasets

Pre-built datasets for guided lessons and sandbox quick-start:

### University Database

- **students** (id, name, age, department_id, gpa)
- **departments** (id, name, head_professor, building)
- **courses** (id, title, credits, department_id)
- **enrollments** (student_id, course_id, semester, grade)
- **professors** (id, name, department_id, salary)

### Banking Database

- **customers** (id, name, address, phone, email)
- **accounts** (id, customer_id, type, balance, opened_date)
- **branches** (id, name, city, assets)
- **transactions** (id, account_id, type, amount, timestamp)
- **loans** (id, customer_id, branch_id, amount, interest_rate)

Each dataset comes with **50–200 rows per table**, generated via Faker.js with realistic data. Students can load any dataset into the sandbox with one click.

---

## 8. Development Phases

### Phase 0 — Project Foundation

> Set up the development environment, install dependencies, configure tooling.

- [x] Initialize Next.js project with TypeScript and App Router
- [x] Configure Tailwind CSS + shadcn/ui
- [x] Set up ESLint + Prettier
- [x] Set up project folder structure (empty files/dirs)
- [x] Set up Vitest for unit testing
- [x] Configure security headers in `next.config.ts`
- [x] Create landing page (hero section, feature cards, CTA)

**Output:** App boots, landing page renders.

---

### Phase 1 — Authentication

> Build client-side auth: registration, login, localStorage persistence.

- [x] Implement client-side SHA-256 hashing via Web Crypto API
- [x] Create login page + form component
- [x] Create registration page + form component
- [x] Build Zustand auth store (persisted to localStorage)
- [x] Build `useAuth` hook

**Output:** Users can register, log in, and stay authenticated via localStorage.

---

### Phase 2 — App Shell & Navigation

> Build the dashboard layout, sidebar, routing structure.

- [x] Create dashboard layout (`(dashboard)/layout.tsx`) with sidebar + header
- [x] Build sidebar with navigation links (Learn, Sandbox, Algebra, ER Builder, Normalizer, Table Generator, Settings)
- [x] Build header with user menu, theme toggle, breadcrumbs
- [x] Build mobile navigation (responsive)
- [x] Create dashboard home page (placeholder cards for now)
- [x] Implement dark/light theme toggle with Zustand
- [x] Create settings page (profile edit, theme preference)

**Output:** Authenticated users see a full app shell with navigation.

---

### Phase 3 — Core Visual Engine

> Build the reusable visualization components that power everything else.

- [x] Build `table-viewer.tsx` — renders any table as a styled, scrollable grid
- [x] Build `table-diff.tsx` — before/after with row-level green/red/yellow highlighting
- [x] Build `row-highlight.tsx` — highlights specific rows (animates in/out)
- [x] Build `column-highlight.tsx` — highlights specific columns (for projections)
- [x] Build `query-display.tsx` — syntax-highlighted SQL/algebra with copy button
- [x] Build `step-navigator.tsx` — playback controls (prev, play/pause, next, speed slider)
- [x] Build `execution-timeline.tsx` — clickable horizontal step timeline
- [x] Build `explanation-panel.tsx` — text + optional diagram for current step
- [x] Build `result-panel.tsx` — final result table display
- [x] Add Framer Motion animations for table transitions (rows sliding in/out, highlights fading)
- [x] Write visual regression tests (snapshot tests)

**Output:** A toolkit of visual components ready to be composed by all features.

---

### Phase 4 — SQL Sandbox

> Build the interactive SQL playground with in-browser execution.

- [x] Set up sql.js (WASM) integration (`lib/engine/sql-executor.ts`)
- [x] Build `useSqlEngine` hook (init, execute, get tables, reset)
- [x] Build SQL editor component with CodeMirror 6 (`sandbox/sql-editor.tsx`)
  - Syntax highlighting, autocomplete (tables, columns, keywords)
  - Execute on Ctrl+Enter / Cmd+Enter
- [x] Build schema browser sidebar (`sandbox/schema-browser.tsx`)
- [x] Build data generator dialog (`sandbox/data-generator-dialog.tsx`)
  - Table name, number of rows, column definitions
  - Auto-generate with Faker.js or manual entry
- [x] Build query history component (`sandbox/query-history.tsx`)
- [x] Build the sandbox page combining all components
- [x] Build Zustand sandbox store (tables, query, results, history)
- [x] Implement CSV export for query results
- [x] Pre-load sample datasets (one-click load University, Banking, etc.)
- [x] Build `lib/engine/data-generator.ts` using Faker.js
- [ ] Write sql-executor unit tests

**Output:** Students can create tables, generate data, write SQL, and see visual results — all in-browser.

---

### Phase 5 — Relational Algebra Playground

> Build the algebra expression parser, evaluator, and visual step-through.

- [x] Build algebra tokenizer (`lib/engine/algebra-parser.ts`) — tokenize σ, π, ⋈, ∪, −, ×, ρ
- [x] Build algebra parser — expression → AST (operation tree)
- [x] Build algebra evaluator (`lib/engine/algebra-evaluator.ts`) — evaluate AST against in-memory tables
- [x] Build symbol palette UI (`algebra/symbol-palette.tsx`)
- [x] Build expression input (`algebra/algebra-input.tsx`) — text input + symbol insertion
- [x] Build expression tree visualization (`algebra/expression-tree.tsx`) — SVG/canvas tree
- [x] Build intermediate result display (`algebra/intermediate-result.tsx`) — table at each tree node
- [x] Build algebra-to-SQL converter (`algebra/algebra-to-sql.tsx`) — shows equivalent SQL
- [x] Build the algebra page combining all components
- [x] Build Zustand algebra store
- [x] Integrate with visual engine (table-viewer, table-diff, step-navigator)
- [ ] Write parser + evaluator unit tests

**Output:** Students type relational algebra, see it parsed into a tree, evaluated step by step, with table diffs at each node.

---

### Phase 6 — ER Diagram Builder

> Build the drag-and-drop ER diagram tool with auto-conversion to relational tables.

- [x] Set up React Flow canvas (`er-diagram/er-canvas.tsx`)
- [x] Build entity node component (rectangle, supports renaming)
- [x] Build weak entity node (double border)
- [x] Build relationship node (diamond shape)
- [x] Build attribute node (oval, with variants: key, multivalued, derived, composite)
- [x] Build cardinality edge labels (1:1, 1:N, M:N)
- [x] Build ER toolbar (add entity, relationship, attribute, delete, export as PNG)
- [x] Build ER-to-relational conversion engine (`lib/engine/er-to-relational.ts`)
- [x] "Convert to Tables" button — generates relational schema from ER diagram
- [x] Display generated tables using `table-viewer`
- [x] Pre-built ER diagrams for case studies (University, Banking)
- [x] Build Zustand ER store (nodes, edges, diagram state)
- [ ] Write ER conversion unit tests

**Output:** Students build ER diagrams visually and auto-generate relational tables.

---

### Phase 7 — Normalization Wizard

> Build the normalization analysis engine and step-by-step decomposition UI.

- [x] Build normalizer engine (`lib/engine/normalizer-engine.ts`):
  - Compute attribute closure
  - Find candidate keys
  - Detect current normal form (UNF through 5NF)
  - Decompose to target NF (e.g., 1NF → 2NF → 3NF)
- [x] Build FD input component (`normalizer/fd-input.tsx`) — add/remove functional dependencies
- [x] Build dependency diagram (`normalizer/dependency-diagram.tsx`) — arrows from determinant to dependent
- [x] Build normal form badge (`normalizer/normal-form-badge.tsx`) — colored badge (UNF=red, 1NF=orange, etc.)
- [x] Build decomposition stepper (`normalizer/decomposition-stepper.tsx`) — animated table splitting
- [x] Build anomaly demo (`normalizer/anomaly-demo.tsx`) — interactive insert/update/delete anomaly
- [x] Build the normalizer page combining all components
- [x] Build Zustand normalizer store
- [ ] Write normalizer engine unit tests (critical: closure, candidate keys, NF detection)

**Output:** Students input a table + FDs, see the current NF, watch step-by-step decomposition with anomaly demos.

---

### Phase 8 — Guided Lessons

> Build the lesson infrastructure and author content for all 5 units.

- [x] Build lesson runner (`lib/lessons/lesson-runner.ts`) — loads content, manages state
- [x] Build step builder (`lib/lessons/step-builder.ts`) — converts lesson content to visual steps
- [x] Build lesson content registry (`lib/lessons/content/index.ts`)
- [x] Define lesson content format (TypeScript objects with step arrays)
- [x] Build topic selection page (`learn/page.tsx`) — grid of units + topics
- [x] Build topic overview page (`learn/[topicSlug]/page.tsx`) — lesson list + progress
- [x] Build lesson player page (`learn/[topicSlug]/[lessonSlug]/page.tsx`)
- [x] Build Zustand lesson store
- [x] Build `useLesson` hook
- [x] Author Unit 1 lessons (4 lessons: intro, data models, architecture, ER diagrams)
- [x] Author Unit 2 lessons (3 lessons: ER→relational, algebra operations, relational calculus)
- [x] Author Unit 3 lessons (9 lessons: DDL, DML, SELECT, constraints, joins, set ops, subqueries, PL/SQL, triggers)
- [x] Author Unit 4 lessons (6 lessons: why normalize, 1NF, 2NF, 3NF, BCNF, 4NF/5NF)
- [x] Author Unit 5 lessons (3 lessons: transactions, concurrency, NoSQL)
- [ ] Test all lessons end-to-end

**Output:** All 25 guided lessons playable with step-by-step visual execution.

---

### Phase 9 — Session Persistence

> Save/restore all user state via localStorage.

- [x] Implement session auto-save (Zustand persist):
  - Sandbox: save tables, data, query history every 30s
  - Lessons: save current step on every step change
  - Algebra/Normalizer: save current state on every change
- [x] Build `useSessionPersistence` hook — auto-save + restore on mount
- [x] Write session persistence tests

**Output:** Full session persistence across all tools.

---

### Phase 10 — Polish, Testing & Deployment

> Harden the app, write comprehensive tests, and deploy.

- [ ] Responsive design audit — test all pages on mobile, tablet, desktop
- [ ] Accessibility audit — keyboard navigation, screen reader labels, ARIA attributes
- [ ] Performance audit — Lighthouse score > 90, lazy load heavy components (React Flow, CodeMirror)
- [ ] Error handling — error boundaries, graceful degradation
- [ ] Loading states — skeleton loaders for all async content
- [ ] SEO — meta tags, Open Graph, structured data for landing page
- [ ] Write remaining unit tests (target 80%+ coverage on engines)
- [ ] Set up CI/CD — GitHub Actions: lint → type-check → test → build
- [ ] Deploy to Vercel
- [x] Write README.md with setup instructions

**Output:** Production-ready application, deployed.

---

## 9. Future Enhancements

Ideas to explore after the core platform is complete:

| Enhancement                | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| **Teacher Dashboard**      | Teachers see class progress, assign exercises, view analytics |
| **Google OAuth**           | Add social login when ready                                   |
| **Collaborative Mode**     | Real-time shared sandbox via WebSockets                       |
| **AI Query Helper**        | LLM explains query errors and suggests fixes                  |
| **Query Optimization Viz** | Show execution plans (cost-based) visually                    |
| **Mobile App**             | React Native or PWA for offline access                        |
| **Multi-language**         | Support other languages beyond English                        |
| **PDF Export**             | Export lesson notes and exercise results as PDF               |
| **Custom Exercises**       | Teachers create and share custom exercises                    |
| **Leaderboard**            | Gamified ranking by exercise completion and speed             |
| **Transaction Simulator**  | Multi-user concurrent transaction visual (for Unit 5)         |
| **SQL Dialect Toggle**     | Switch between MySQL, PostgreSQL, SQLite syntax               |

---

_This roadmap is a living document. Update it as the project evolves._
