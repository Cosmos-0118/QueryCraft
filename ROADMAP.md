# Normalizer Studio — Rebuild Roadmap

> **Goal**: Rebuild the Normalizer Studio from scratch with a free-canvas UI (like the ER Diagram Builder), a standalone normalization engine, and step-by-step visual transformations from UNF through 5NF.

---

## Architecture Overview

```
src/
├── app/(dashboard)/normalizer/
│   └── page.tsx                          # Main page (ReactFlowProvider + canvas + panels)
├── components/normalizer/
│   ├── normalizer-canvas.tsx             # ReactFlow canvas with table nodes
│   ├── table-node.tsx                    # Custom node: renders a table with columns/keys
│   ├── fk-edge.tsx                       # Custom edge: FK relationship arrows
│   ├── normalizer-toolbar.tsx            # Top toolbar (presets, import, export, settings)
│   ├── input-panel.tsx                   # Side panel: table editor + FD editor
│   ├── nf-stepper.tsx                    # Normal form step navigator (UNF → 5NF)
│   ├── nf-step-detail.tsx               # Explanation card for each NF transition
│   └── anomaly-highlight.tsx            # Visual anomaly demo overlay on table nodes
├── lib/engine/
│   └── normalizer-engine.ts             # Pure normalization engine (zero UI deps)
├── stores/
│   └── normalizer-store.ts              # Zustand store with persistence
└── types/
    └── normalizer.ts                    # Shared TypeScript types
```

---

## Phase 1 — Types & Engine (Pure Logic, No UI)

### [ ] Step 1: Define core types (`src/types/normalizer.ts`)

Create all shared TypeScript interfaces:

```
NormalForm          = 'UNF' | '1NF' | '2NF' | '3NF' | 'BCNF' | '4NF' | '5NF'
FunctionalDependency = { determinant: string[]; dependent: string[] }
MultivaluedDependency = { determinant: string[]; dependent: string[] }
JoinDependency       = { components: string[][] }
TableSchema          = { id: string; name: string; columns: Column[]; primaryKey: string[];
                         foreignKeys: ForeignKey[]; fds: FunctionalDependency[];
                         mvds: MultivaluedDependency[]; sampleData?: string[][] }
Column               = { name: string; type?: string; isKey: boolean }
ForeignKey           = { columns: string[]; referencesTable: string; referencesColumns: string[] }
NormalizationStep    = { fromNF: NormalForm; toNF: NormalForm; inputTables: TableSchema[];
                         outputTables: TableSchema[]; explanation: string;
                         violationsFound: Violation[]; anomalyDemo?: AnomalyDemo }
Violation            = { type: 'partial' | 'transitive' | 'bcnf' | 'mvd' | 'jd';
                         determinant: string[]; dependent: string[]; explanation: string }
AnomalyDemo          = { insertAnomaly?: string; deleteAnomaly?: string; updateAnomaly?: string }
NormalizationResult  = { steps: NormalizationStep[]; detectedNF: NormalForm;
                         targetNF: NormalForm; originalTable: TableSchema }
```

- Include JSDoc comments on every interface
- Export everything from the barrel

### [ ] Step 2: Build the normalization engine core (`src/lib/engine/normalizer-engine.ts`)

Implement a self-contained engine with zero UI dependencies:

**2a — Utility functions**
- `attributeClosure(attrs, fds)` — compute closure of a set of attributes under FDs
- `findCandidateKeys(columns, fds)` — find all candidate keys using closure
- `minimalCover(fds)` — compute the minimal (canonical) cover of a set of FDs
- `isSuperKey(attrs, columns, fds)` — check if attrs is a superkey
- `expandToSingletonFDs(fds)` / `mergeSingletonFDs(singletons)` — FD normalization helpers
- `combinations(arr, size)` — generator for k-combinations
- `isSubset(a, b)` / `isProperSubset(a, b)` / `areSameSet(a, b)` — set helpers

**2b — Normal form detection**
- `detectNormalForm(table)` → `NormalForm` — analyze a table and return its current NF
- Check for multi-valued cells → UNF
- Check partial dependencies → 1NF (not 2NF)
- Check transitive dependencies → 2NF (not 3NF)
- Check all non-trivial FDs have superkey determinants → 3NF (not BCNF)
- Check multi-valued dependency violations → BCNF (not 4NF)
- Check join dependency violations → 4NF (not 5NF)
- All clear → 5NF

**2c — FD inference from sample data**
- `inferFunctionalDependencies(columns, rows)` → `FunctionalDependency[]`
- Use data-driven approach: for each candidate determinant, check if it functionally determines each other column
- Apply heuristic scoring to prioritize identifier-like columns
- Minimize the result set to remove redundant FDs

**2d — Primary key inference**
- `inferPrimaryKey(columns, rows, fds)` → `string[]`
- Try uniqueness from data first, then fall back to candidate keys from FDs
- Score by identifier naming conventions (`_id`, `id`, `key`, etc.)

**2e — Decomposition functions (one per NF transition)**
- `decomposeTo1NF(table)` — flatten multi-valued cells into atomic rows
- `decomposeTo2NF(tables)` — split out partial dependencies
- `decomposeTo3NF(tables)` — 3NF synthesis algorithm using minimal cover
- `decomposeToBCNF(tables)` — iterative BCNF decomposition
- `decomposeTo4NF(tables)` — split on MVD violations
- `decomposeTo5NF(tables)` — split on join dependency violations

**2f — Main entry point**
- `normalize(table, targetNF)` → `NormalizationResult`
- Runs detection, then applies each decomposition step in order
- Records violations, explanations, and anomaly demos at each step
- Supports "any table the user throws at it" — handles edge cases like:
  - Tables with no FDs
  - Tables already in the target NF
  - Tables with only 1-2 columns (cannot decompose further)
  - Empty tables / tables with no sample data

### [ ] Step 3: Write comprehensive unit tests (`tests/normalizer/engine/normalizer-engine.test.ts`)

Cover at least these scenarios:

- Attribute closure correctness
- Candidate key finding (single key, composite key, multiple candidate keys)
- Minimal cover computation
- NF detection for tables at each level (UNF, 1NF, 2NF, 3NF, BCNF, 4NF, 5NF)
- 1NF: multi-valued cell expansion (pipe, comma, semicolon separators)
- 2NF: partial dependency removal with composite keys
- 3NF: transitive dependency removal via synthesis
- BCNF: non-superkey FD decomposition
- 4NF: multi-valued dependency decomposition
- 5NF: join dependency decomposition
- Full `normalize()` pipeline from UNF → 5NF
- Edge cases: single-column tables, all-key tables, empty data, no FDs
- Lossless join verification on decomposition results
- Dependency preservation verification on 3NF results

---

## Phase 2 — Zustand Store & Persistence

### [ ] Step 4: Create the Zustand store (`src/stores/normalizer-store.ts`)

State shape:

```typescript
interface NormalizerState {
  // Input
  inputTable: TableSchema | null;
  
  // Engine results
  result: NormalizationResult | null;
  currentStepIndex: number;
  
  // Canvas state
  selectedNodeId: string | null;
  
  // UI preferences
  showSampleData: boolean;
  showFDs: boolean;
  showAnomalies: boolean;
  
  // Actions
  setInputTable(table: TableSchema): void;
  runNormalization(targetNF: NormalForm): void;
  setStep(index: number): void;
  selectNode(id: string | null): void;
  toggleSampleData(): void;
  toggleFDs(): void;
  toggleAnomalies(): void;
  loadPreset(name: string): void;
  clear(): void;
}
```

- Use `persist` middleware with `userScopedStateStorage`
- Register in `STORAGE_BASE_KEYS` (key: `'normalizer'`)
- Register in `user-scoped-store-sync.ts` for user-switch rehydration
- Partialize: only persist `inputTable`, `currentStepIndex`, and UI preferences

### [ ] Step 5: Wire store to the app infrastructure

- Add `'normalizer'` back to `sessionType` enum in `validators.ts`
- Import and rehydrate in `user-scoped-store-sync.ts`
- Verify sidebar nav item in `layout.tsx` still points to `/normalizer`

---

## Phase 3 — Canvas UI Components

### [ ] Step 6: Create the table node component (`src/components/normalizer/table-node.tsx`)

A custom ReactFlow node that renders a single relational table:

- **Header**: table name with NF badge (e.g. "Student" with a "3NF" pill)
- **Column rows**: each column with icon for PK (key icon), FK (link icon), or regular
- **Sample data toggle**: expand/collapse to show 3-5 sample rows below the columns
- **Highlight state**: glow border when the table has violations
- **Styling**: match the ER builder's entity node aesthetic (rounded-2xl, border, glass bg)
- **Drag handles**: use ReactFlow's built-in node dragging
- Dark theme by default, matching the app's design system

### [ ] Step 7: Create the FK edge component (`src/components/normalizer/fk-edge.tsx`)

A custom ReactFlow edge for foreign key relationships:

- Animated dashed line from FK column to referenced PK
- Label showing the FK constraint (e.g. "student_id → Student.id")
- Color-coded: violet for PK→FK, muted for regular references
- Smooth step edge type for clean routing

### [ ] Step 8: Create the normalizer canvas (`src/components/normalizer/normalizer-canvas.tsx`)

Main ReactFlow canvas component:

- Register custom node type: `'table'` → `TableNode`
- Register custom edge type: `'fk'` → `FKEdge`
- `Background` component with dots pattern
- `Controls` component for zoom/fit
- `MiniMap` for navigation
- Auto-layout tables in a grid when a new NF step is shown
  - Use a simple layout algorithm: tables flow left-to-right, wrapping to rows
  - Animate node positions when transitioning between NF steps
- Convert `NormalizationStep.outputTables` into ReactFlow nodes and edges
- Handle node selection → update store's `selectedNodeId`

### [ ] Step 9: Create the input panel (`src/components/normalizer/input-panel.tsx`)

Right-side panel (like ER Builder's PropertiesPanel):

- **Table name input**: editable text field
- **Column editor**: add/remove/reorder columns with name + type
- **Sample data editor**: spreadsheet-like grid for entering rows
  - Supports paste from spreadsheet
  - Auto-detects multi-valued cells
- **FD editor**: 
  - Auto-inferred FDs displayed as read-only chips
  - Manual FD entry: pick determinant columns → pick dependent columns → add
  - Remove button on each FD
- **Import from seed datasets**: dropdown to load university/banking/credentia
- Matches the ER PropertiesPanel width (w-72) and styling

### [ ] Step 10: Create the NF step navigator (`src/components/normalizer/nf-stepper.tsx`)

Horizontal stepper bar showing the normalization journey:

- Steps: UNF → 1NF → 2NF → 3NF → BCNF → 4NF → 5NF
- Each step is a pill/button with:
  - Normal form label
  - Status indicator: completed (check), active (highlighted), future (muted)
  - Click to jump to that step's canvas view
- Current step highlighted with accent color (amber/orange theme)
- Compact design: sits between toolbar and canvas
- Shows table count at each step (e.g. "3NF (4 tables)")

### [ ] Step 11: Create the NF step detail card (`src/components/normalizer/nf-step-detail.tsx`)

Expandable explanation card below the canvas:

- Shows for the currently active NF step
- **Violation section**: lists each violation found with determinant/dependent highlighted
- **Explanation**: prose explanation of what transformation was applied
- **Anomaly demo**: shows insert/update/delete anomaly examples if available
- **Before/After**: mini table comparison showing the split
- Collapsible with smooth animation

### [ ] Step 12: Create the toolbar (`src/components/normalizer/normalizer-toolbar.tsx`)

Top toolbar matching ER Builder style:

- **Preset buttons**: University, Banking, Credentia (like ER presets)
- **Target NF dropdown**: select target normal form to normalize to
- **Run Normalization** button: primary CTA with gradient (amber/orange)
- **Export PNG**: export canvas as image (reuse `html-to-image` pattern from ER builder)
- **Clear workspace** button
- **View toggles**: sample data, FDs, anomalies

---

## Phase 4 — Page Assembly & Integration

### [ ] Step 13: Build the normalizer page (`src/app/(dashboard)/normalizer/page.tsx`)

Assemble all components into the final page:

```
┌──────────────────────────────────────────────────────────┐
│  Header: "Normalizer Studio" + stats (tables, columns)  │
├──────────────────────────────────────────────────────────┤
│  Toolbar: [Presets] [Target NF ▼] [▶ Normalize] [Export] │
├──────────────────────────────────────────────────────────┤
│  NF Stepper: [UNF] → [1NF] → [2NF] → [3NF] → ...      │
├─────────────────────────────────────────────┬────────────┤
│                                             │            │
│           ReactFlow Canvas                  │   Input    │
│     (table nodes + FK edges)                │   Panel    │
│                                             │  (w-72)    │
│                                             │            │
├─────────────────────────────────────────────┴────────────┤
│  Step Detail: Violations | Explanation | Anomaly Demo    │
└──────────────────────────────────────────────────────────┘
```

- Wrap in `ReactFlowProvider` (same pattern as ER builder)
- Wire all components to the Zustand store
- Handle keyboard shortcuts (Ctrl+Enter to run normalization)
- Responsive: panel collapses on mobile
- Loading state while engine runs (show skeleton on canvas)

### [ ] Step 14: Update the loading state (`src/app/(dashboard)/normalizer/loading.tsx`)

- Create or update the loading skeleton to match the new canvas layout
- Show ghost toolbar, stepper, and canvas placeholder

### [ ] Step 15: Remove the placeholder "Coming Soon" page

- Replace the temporary page created during cleanup with the real implementation
- Verify the route `/normalizer` loads the full canvas UI

---

## Phase 5 — Polish & Edge Cases

### [ ] Step 16: Auto-layout algorithm for table nodes

- Implement a force-directed or grid layout for positioning tables on the canvas
- Tables from the same decomposition step should be grouped
- Animate transitions when stepping through NF levels
- Support manual repositioning (positions persist in store)

### [ ] Step 17: Canvas transitions between NF steps

- When user clicks a different NF step in the stepper:
  - Smoothly animate table nodes to new positions
  - Fade out removed tables, fade in new ones
  - Highlight the tables that were split or modified
  - Edge animations for new FK relationships

### [ ] Step 18: Anomaly visualization overlays

- When anomalies are toggled on:
  - Highlight affected rows in sample data with red/yellow indicators
  - Show tooltip explaining the anomaly type
  - Animate the anomaly scenario (e.g. "deleting this row would lose...")

### [ ] Step 19: Export & sharing

- PNG export of the current canvas state (reuse ER builder's `toPng` pattern)
- Copy normalization report as markdown
- Copy generated SQL DDL for the normalized schema

### [ ] Step 20: Seed dataset integration

- Reuse existing seed datasets (university, banking, credentia)
- Load any table from a dataset as input to the normalizer
- Pre-populate sample data and auto-infer FDs on load

### [ ] Step 21: Final testing & cleanup

- Run all unit tests and verify they pass
- Manual testing with all three preset datasets
- Test edge cases: empty tables, single-column, all-key, no FDs
- Verify persistence works across page refreshes and user switches
- Check responsive layout on mobile breakpoints
- Verify no lint errors across all new files
- Update README.md to reflect the new normalizer features

---

## Reference: ER Builder Patterns to Follow

| Pattern | ER Builder File | Normalizer Equivalent |
|---|---|---|
| ReactFlow setup | `er-canvas.tsx` | `normalizer-canvas.tsx` |
| Custom node | `entity-node.tsx` | `table-node.tsx` |
| Custom edge | `floating-edge.tsx` | `fk-edge.tsx` |
| Side panel | `properties-panel.tsx` | `input-panel.tsx` |
| Toolbar | `er-toolbar.tsx` | `normalizer-toolbar.tsx` |
| Store | `er-store.ts` | `normalizer-store.ts` |
| Types | `er-diagram.ts` | `normalizer.ts` |
| Engine | `er-to-relational.ts` | `normalizer-engine.ts` |
| Page assembly | `er-builder/page.tsx` | `normalizer/page.tsx` |
| PNG export | `toPng` in page | Same pattern in toolbar |
| Presets | Inline diagram objects | Seed dataset loading |

---

## Color Theme

The normalizer uses an **amber/orange** accent to distinguish from the ER builder's violet:

- Primary accent: `amber-500` / `orange-500`
- Gradient: `from-amber-500 to-orange-500`
- Badges: `bg-amber-500/12 text-amber-300`
- Borders: `border-amber-500/25`
- Glow: `shadow-amber-500/20`
