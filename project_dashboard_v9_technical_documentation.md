# LEAF Project Dashboard — v9 Technical Documentation

## 1) Overview

The LEAF Project Dashboard provides a unified view into Projects, Tasks, and Analytics (including OKR roll-ups). The dashboard is a single-page application rendered from HTML/CSS/JS with client-side aggregation over LEAF form query data.

Primary functional views:

- Projects
- Tasks
- Analytics (Project analytics + OKR roll-up)

Version reference: v9.

## 2) File Structure and Versioning

- `project_v9.html`
  - Page structure, layout scaffolding, tab containers, and modal plumbing.
  - OKR Analytics containers (filters, quick view, index, roll-up).
- `project_v9.css`
  - Dashboard styling (tables, cards, filters, tasks, OKR roll-up UI, badges, progress bars).
- `project_v9.js`
  - Data fetching, normalization, filtering, aggregation, rendering, and UI behavior.

v9 supersedes v7/v8 architecture and is the current baseline. v7 remains for reference only. v9 adds performance-focused refactors (lazy tab/view init, derived caching, task table virtualization, Kanban caps + load more, incremental analytics updates) while preserving data correctness and existing business logic.

## 3) Data Model and Indicator Mapping

All relationships are derived via string matching (no foreign keys). Indicators are sourced from LEAF form data.

Tasks (Task form):

- `indicatorID 8` — Project Key
- `indicatorID 9` — Task Title
- `indicatorID 10` — Status
- `indicatorID 44` — Other subtype (Blocked / On Hold)
- `indicatorID 11` — Assigned To
- `indicatorID 12` — Start Date
- `indicatorID 13` — Due Date
- `indicatorID 14` — Priority
- `indicatorID 16` — Category
- `indicatorID 17` — Dependencies
- `indicatorID 18` — Support Ticket
- `indicatorID 30` — Task OKR Key
- `indicatorID 39` — Task Key Result

Projects (Project form):

- `indicatorID 2` — Project Key
- `indicatorID 3` — Project Name
- `indicatorID 4` — Description
- `indicatorID 5` — Owner
- `indicatorID 6` — Project Status
- `indicatorID 38` — Project Fiscal Year
- `indicatorID 29` — Project OKR Key
- `indicatorID 32` — Project Type
- `indicatorID 37` — Project Key Result

OKRs (Project form):

- `indicatorID 23` — OKR Key
- `indicatorID 24` — Objective Title
- `indicatorID 25` — Objective Start Date
- `indicatorID 26` — Objective End Date
- `indicatorID 33` — OKR Fiscal Year

Key Results (Key Result form):

- `indicatorID 35` — Key Result OKR Key
- `indicatorID 36` — Key Result Name

Relationships:

- Objective → Key Result via OKR Key (23/35) and KR name (36)
- Project → Objective/KR via project OKR key (29) and project KR name (37)
- Task → Objective/KR via task OKR key (30) and task KR name (39)
- Task → Project via task project key (8) matched to project key (2)

Normalization:

- OKR keys are normalized via `normalizeOkrKey`.
- Key Result matching uses normalized names (`normalizeKeyResultMatch`).
- Project keys are normalized by replacing NBSP, trimming, collapsing whitespace, and uppercasing (`normalizeProjectKey`).

New or expanded mappings post‑v7:

- `supportTicket` (18) powers ticket links/chips and the Tickets Imported analytics series.
- `projectType` (32) drives Projects by Type analytics.
- Analytics windows use task/project `createdAt` when available (fallback to start/due).

## 4) OKR Analytics View (v9 Behavior)

### O and KR Health Quick View

Displays compact metrics for the selected Fiscal Year:

- Objectives count
- Key Results count
- Overall percent = average of OKR card percentages

All values use the same OKR aggregation as the cards and update when the FY filter changes.

### OKR Index

- Compact scan list of OKRs: OKR key, objective title (single line, truncated), percent with progress bar.
- Clicking an index item scrolls to and expands the OKR card.
- Keyboard operable (Enter/Space).

### OKR Details

- OKR cards are collapsed by default with summary metrics.
- Expanded OKR cards show all Key Results (no pagination of KRs).
- Each Key Result row includes:
  - Name
  - Percent bar + value
  - Task counts and project count
  - Details toggle to show nested content

Nested content:

- Projects list with tasks nested under each project
- “Other contributing items” bucket

Project resolution logic (authoritative dataset + normalization):

- Authoritative project dataset: `state.projectsAll` (Project form query). For OKR roll‑ups, this is filtered by the OKR Fiscal Year selection to produce `okrBaseProjects`.
- A project map is built from `okrBaseProjects` using normalized project keys (`normalizeProjectKey`) as map keys.
- Each KR classification computes:
  - `krProjects`: projects explicitly tagged to the KR (project KR selection matches KR name).
  - `krTasks`: tasks tagged to the KR (task KR selection matches KR name), deduped by stable task key.
  - `projectsToRender`: union of `krProjects` plus projects resolved from task project keys via the project map.
  - `tasksByProjectKey`: tasks grouped under resolved project keys.
  - `otherTasks`: tasks not rendered under any resolved project (missing/unknown project key or project not in the FY‑filtered project map).

Other contributing items:

- Includes KR‑matching tasks that cannot be resolved to a project in the authoritative project map.
- Hidden entirely when count = 0.
- Sorted: incomplete first, then alphabetical by task name.

Percent completion calculations:

- KR percent = completed tasks / total tasks for the KR.
- OKR percent = average of KR percents.
- Quick View overall percent = average of OKR percents.

## 5) Expansion & Interaction Logic

- Objective cards: collapsed by default; expand to show all Key Results.
- Key Result details: expanding shows nested projects and tasks immediately.
- Collapsible controls use `aria-expanded` and `aria-controls` and remain keyboard operable.
- “Show more Objectives” is used for long OKR lists.

## 6) Tasks View (v9)

Task ID styling (presentation):

- Background: `#1f1f1f`
- Sharp rectangle edges (radius 0)
- Applied consistently to Tasks table and Kanban view

Task table virtualization:

- Fixed row height with top/bottom spacers to preserve scroll height.
- Only visible rows + buffer are rendered.
- Keyboard focus is preserved within the visible window.

Kanban behavior:

- Columns defined by `STATUS_CONFIG` (legacy vs dev mode).
- Per‑column render caps (`KANBAN_RENDER_LIMIT`) with “Load more” to append cards.
- Drag‑and‑drop operates on rendered cards and updates status + indicator 44 as needed.
- Column headers and counts always render, even with zero matches.

## 7) Selector UI Pattern (Shared htmlEdit scripts)

Shared selector UI behaviors used in htmlEdit scripts for OKR/Project/KR pickers:

- Collapsed summary row with selected value and “Change” button.
- Panel expands for search + selection; auto‑collapses after selection.
- Shared CSS injection using a single `style` tag (`#pm-picker-styles`).
- Accessible focus styles and keyboard operability.
- Persistence logic unchanged (selectors write to existing indicator fields).

## 8) Filter Architecture (v9)

- Filters are single‑select `<select>` controls (one value or “All”).
- Filter logic: AND across filters; each filter matches exact value. Empty selection = “All”.
- Tasks filters include Project, Status, Assigned To, Category, Priority, and Dev‑Only toggle.
- Search is debounced (≈275ms) and applied across multiple task fields.
- Analytics filters (Year/Quarter) constrain chart windows for tasks and projects.
- OKR Fiscal Year filter constrains the project dataset used for OKR roll‑ups and OKR tables.

FY interaction with OKR calculations:

- FY selection filters `okrBaseProjects` (authoritative project dataset for OKR rollups).
- Tasks are not directly filtered by FY; tasks referencing projects outside the FY map are surfaced under “Other contributing items.”

## 9) Performance Considerations (v9)

- Lazy tab/view initialization: heavy content is rendered only on first view activation.
- Derived caches for filters/sorts/kanban/analytics/OKRs keyed by signatures with versioning.
- Incremental cache updates on task changes (status, indicator 44, etc.).
- Analytics buckets (including Other/Blocked/On Hold) are incrementally updated.
- Debounced search input to avoid recomputation on each keystroke.
- Task table virtualization reduces DOM load for large datasets.
- Kanban caps prevent rendering thousands of cards per column.

## 10) Lifecycle & Initialization Flow

- `DOMContentLoaded` → `main()` initializes UI wiring, then loads data.
- Data loads:
  - Projects query (Project form indicators)
  - Tasks query (Task form indicators)
  - Key Results query (Key Result form indicators)
- After fetch:
  - Normalize and store `state.projectsAll`, `state.tasksAll`, `state.keyResultsAll`.
  - Build project key → record ID/title maps for linking and labels.
  - Populate filter options.
  - Apply initial render based on active tab (from localStorage).
- Tab activation:
  - Stores `activeTab` in localStorage.
  - Renders only the active tab; first‑time initialization is gated by `tabInit` and `viewInit` flags.
- Filter changes:
  - `applySearchAndFilters()` re‑renders only the active tab.
  - Cached results are reused when signatures match.

## 11) Version History

- v7: OKR roll‑up structural refactor (Quick View, Index, Roll‑up details).
- v7.1: multi‑select filters introduced in some deployments.
- v8: performance refactor baseline (lazy tab init and caching).
- v9: stabilized performance and UX (virtualized task table, Kanban caps + load more, incremental analytics updates, lazy view initialization).
