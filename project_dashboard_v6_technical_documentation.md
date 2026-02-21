# LEAF Project Dashboard v6 Technical Documentation

## Overview
Technical documentation for project_v6, focused on architecture, data flow, and implementation behavior. v6 is currently in an iterative enhancement phase.

## System purpose from a technical perspective
Provide a client-rendered dashboard that queries LEAF platform data, normalizes it into consistent models, and renders projects, tasks, and analytics views with interactive filtering, sorting, and roll-ups.

## Scope boundaries
- Includes dashboard UI, data fetching, and client-side analytics rendering
- Excludes underlying LEAF form definitions and server-side workflows
- Excludes cross-module automation not represented in dashboard logic

## Current State: project_v6 (Iterative Enhancement Phase)

### Core capabilities
- Projects and Tasks tabs with searchable, filterable tables
- Tasks views for table, Kanban, and Gantt
- Analytics tab with charts, roll-ups, and health tables
- Modal-based record viewing and creation workflows

### UI structure
- Top-level tabs: Projects, Tasks, Analytics
- Shared search and filter controls
- Task view toggles for Table, Kanban, and Gantt layouts
- Analytics panels with charts and roll-up tables

### Role-based visibility behavior
- Read-only access associated with group-based membership for restricted controls
- Action buttons and creation workflows visible to LEAF Team membership

### Analytics roll-ups and indicator health scoring logic
- Task completion and overdue calculations are aggregated by project key
- Health scoring reflects completion percentage and overdue counts
- Roll-ups feed charts and summary tables in the Analytics view

### Known constraints
- Indicator IDs are hard-coded and must remain aligned with LEAF form configurations
- Data loading relies on LEAF API availability and session authentication
- Client-side rendering may degrade with very large datasets
- Gantt and Kanban views are limited by the task fields present in project_v6 queries

## Technical Architecture

### File structure and naming conventions
- Entry point: `project_v6.html`
- Styles: `project_v6.css`
- Logic: `project_v6.js`
- Asset paths referenced in `project_v6.html` include `./files/project_v6.css`, `./files/chart.js`, and `./files/project_v6.js`

### Front-end stack (if applicable)
- Vanilla HTML, CSS, and JavaScript
- Chart rendering via Chart.js

### Explicitly state whether external dependencies exist
External dependencies exist: Chart.js is referenced via `./files/chart.js` in `project_v6.html`. No remote CDN dependencies are referenced in `project_v6.html`.

### Indicator and data model integration
- Task, Project, OKR, and Key Result indicator IDs are defined in `project_v6.js`
- Form query results are normalized into project, task, and key result objects
- Indicator mapping drives filters, tables, and analytics calculations

### Data flow logic
- On load, the dashboard fetches CSRF tokens and form query data
- Project and task rows are filtered to records containing indicator values
- Normalized data is stored in in-memory state for rendering
- Filters, sorting, and view toggles update the DOM and charts client-side

### Dashboard interaction patterns (modals, filtering, sorting, roll-ups)
- Modal iframe for record detail and creation workflows
- Search, filter dropdowns, and table sorting with state persistence
- Kanban drag-and-drop interactions for task status changes
- Analytics roll-ups recalculated on filter changes

### Performance considerations
- Single-page client render with all data loaded at startup
- Chart re-rendering on filter changes can be a bottleneck with large datasets
- DOM updates for tables and boards are synchronous and scale with record counts

## Embedded Logic Considerations: Form Fields and print_form Views
### Addendum Overview
- Purpose of this addendum: Document embedded form-field programmer logic and Project print view customizations used by the LEAF Project Dashboard (v6).
- Relationship to project_dashboard_v6_technical_documentation.md: Companion technical addendum focused on form-field behavior and print_form customizations referenced in that document.
- Summary of what was customized (forms + print views): Custom selector UIs for Project, Task, OKR, and Key Result associations; auto-numbering for Project and OKR keys; Task dependency selector and persistence; Project print view rendering enhancements for dependencies and ticket links.

### Form Field Customizations

#### autonumber_OKR.js
- File path: `autonumber_OKR.js`
- Installed in: OKR Form `form_a2b55`, Field `OKR Key`, indicatorID `23` (OKR Key programmer field)
- User-facing behavior: Auto-generates and locks the OKR Key after record creation.
- Data written: indicatorID `23` set to `OKR-{recordID}`; interim value `OKR-PENDING` for new records.
- Data source: Record ID from URL (`recordID` query param or `/api/form/{id}` path).
- Validation and fallbacks: If record ID is not available, uses `OKR-PENDING`. If the indicator input is not found, no changes occur.
- Known edge cases: New record without record ID, delayed field render, URL patterns not matching, permissions blocking reload, fetch/XHR interception conflicts.

Testing checklist:
1. Create a new OKR and confirm the field shows `OKR-PENDING` before submit.
2. Submit the new OKR and confirm the page reloads and updates to `OKR-{recordID}`.
3. Open an existing OKR and confirm the field matches the record ID and is read-only.
4. Confirm manual edits are blocked in the UI.

#### OKRkey_htmlEdit_29.js
- File path: `OKRkey_htmlEdit_29.js`
- Installed in: Key Results Form `form_6530b`, Field `OKR Key`, indicatorID `29` (OKR Key programmer field)
- User-facing behavior: Replaces the native OKR key field with a searchable OKR selector.
- Data written: indicatorID `29` set to the selected OKR key as plain text.
- Data source: LEAF form query endpoint for OKR records; reads OKR key indicator `23` and OKR name indicator `24`.
- Validation and fallbacks: If the bound indicator field is not found, shows an error and stops. If the OKR list is empty, the selector shows no matches.
- Known edge cases: OKR list fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Key Result and confirm OKR list loads.
2. Search by key and name and confirm filtering works.
3. Select an OKR and confirm the OKR Key field persists after save.
4. Confirm the selected value is written to indicatorID `29`.

#### autonumber_LEAF.js
- File path: `autonumber_LEAF.js`
- Installed in: Project Form `form_55445`, Field `Project Key`, indicatorID `2` (Project Key programmer field)
- User-facing behavior: Auto-generates and locks the Project Key after record creation.
- Data written: indicatorID `2` set to `LEAF-{recordID}`; interim value `LEAF-PENDING` for new records.
- Data source: Record ID from URL (`recordID` query param or `/api/form/{id}` path).
- Validation and fallbacks: If record ID is not available, uses `LEAF-PENDING`. If the indicator input is not found, no changes occur.
- Known edge cases: New record without record ID, delayed field render, URL patterns not matching, permissions blocking reload, fetch/XHR interception conflicts.

Testing checklist:
1. Create a new Project and confirm the field shows `LEAF-PENDING` before submit.
2. Submit the new Project and confirm the page reloads and updates to `LEAF-{recordID}`.
3. Open an existing Project and confirm the field matches the record ID and is read-only.
4. Confirm manual edits are blocked in the UI.

#### OKRkey_htmledit_30.js
- File path: `OKRkey_htmledit_30.js`
- Installed in: Project Form `form_55445`, Field `Objective`, indicatorID `30` (Objective programmer field)
- User-facing behavior: Replaces the native Objective/OKR key field with a searchable OKR selector.
- Data written: indicatorID `30` set to the selected OKR key as plain text.
- Data source: LEAF form query endpoint for OKR records; reads OKR key indicator `23` and OKR name indicator `24`.
- Validation and fallbacks: If the bound indicator field is not found, shows an error and stops. If the OKR list is empty, the selector shows no matches.
- Known edge cases: OKR list fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Project and confirm OKR list loads.
2. Search by key and name and confirm filtering works.
3. Select an OKR and confirm the Objective field persists after save.
4. Confirm the selected value is written to indicatorID `30`.

#### KR_Selector_project.js
- File path: `KR_Selector_project.js`
- Installed in: Project Form `form_55445`, Field `Key Result`, indicatorID `37` (Key Result programmer field)
- User-facing behavior: Replaces the native Key Result field with a searchable picker; the picker is hidden until an OKR is selected.
- Data written: indicatorID `37` set to the selected Key Result name as plain text.
- Data source: LEAF form query endpoint for Key Results; reads KR name indicator `36` and parent OKR key indicator `35`. Uses Objective indicator `30` on the Project form as the OKR selection.
- Validation and fallbacks: If indicator `37` is not found, shows an error and stops. If the OKR is cleared, the KR value is cleared and the picker is hidden. If no matching KRs are found, a non-blocking message is shown.
- Known edge cases: Missing OKR value (indicator `30`), empty KR list, fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Project with no OKR selected and confirm the KR picker is hidden and the helper text shows.
2. Select an OKR and confirm the KR list loads and filters to that OKR.
3. Select a KR and confirm indicator `37` stores the KR name and persists after save.
4. Clear the OKR and confirm the KR selection is cleared.

#### projectkey_selector.js
- File path: `projectkey_selector.js`
- Installed in: Task Form `form_9b302`, Field `Project Key`, indicatorID `8` (Project Key programmer field)
- User-facing behavior: Replaces the native Project Key field with a searchable project selector.
- Data written: indicatorID `8` set to the selected Project Key as plain text.
- Data source: LEAF form query endpoint for Project records; reads Project Key indicator `2` and Project Name indicator `3`.
- Validation and fallbacks: If indicator `8` is not found, shows an error and stops. If the project list is empty, the selector shows no matches.
- Known edge cases: Project list fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Task and confirm project list loads.
2. Search by key and name and confirm filtering works.
3. Select a project and confirm indicator `8` stores the Project Key and persists after save.
4. Clear selection and confirm the field is cleared.

#### OKRkey_htmlEdit_35.js
- File path: `OKRkey_htmlEdit_35.js`
- Installed in: Task Form `form_9b302`, Field `Objective`, indicatorID `35` (Objective programmer field)
- User-facing behavior: Replaces the native Objective/OKR key field with a searchable OKR selector.
- Data written: indicatorID `35` set to the selected OKR key as plain text.
- Data source: LEAF form query endpoint for OKR records; reads OKR key indicator `23` and OKR name indicator `24`.
- Validation and fallbacks: If the bound indicator field is not found, shows an error and stops. If the OKR list is empty, the selector shows no matches.
- Known edge cases: OKR list fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Task and confirm OKR list loads.
2. Search by key and name and confirm filtering works.
3. Select an OKR and confirm the Objective field persists after save.
4. Confirm the selected value is written to indicatorID `35`.

#### KR_Selector_task.js
- File path: `KR_Selector_task.js`
- Installed in: Task Form `form_9b302`, Field `Key Result`, indicatorID `39` (Key Result programmer field)
- User-facing behavior: Replaces the native Key Result field with a searchable picker; the picker is hidden until an OKR is selected.
- Data written: indicatorID `39` set to the selected Key Result name as plain text.
- Data source: LEAF form query endpoint for Key Results; reads KR name indicator `36` and parent OKR key indicator `35`. Uses Objective indicator `35` on the Task form as the OKR selection.
- Validation and fallbacks: If indicator `39` is not found, shows an error and stops. If the OKR is cleared, the KR value is cleared and the picker is hidden. If no matching KRs are found, a non-blocking message is shown.
- Known edge cases: Missing OKR value (indicator `35`), empty KR list, fetch failures, indicator field not present in the DOM, permissions blocking form query, iframe render timing delays before the field exists.

Testing checklist:
1. Open a Task with no OKR selected and confirm the KR picker is hidden and the helper text shows.
2. Select an OKR and confirm the KR list loads and filters to that OKR.
3. Select a KR and confirm indicator `39` stores the KR name and persists after save.
4. Clear the OKR and confirm the KR selection is cleared.

#### dependencies_selector.js
- File path: `dependencies_selector.js`
- Installed in: Task Form `form_9b302`, Field `Dependencies`, indicatorID `17` (Dependencies programmer field)
- User-facing behavior: Searchable multi-select list of tasks with a separate Selected panel; users can add/remove dependencies and save.
- Data written: indicatorID `17` stored as JSON array string in the format `[{"id":"<taskRecordID>","title":"<taskTitle>"}, ...]`. Backward-compatible parsing supports newline `id | title` lines.
- Data source: LEAF form query endpoint for Tasks with filters `stepID != resolved` and `deleted = 0`; reads Task Title indicator `9` and Project Key indicator `8`. Excludes the current task record ID from available options.
- Validation and fallbacks: If indicator `17` is not found, shows an error and stops. Save requires `recordID` and `CSRFToken`; the Save button posts to `/platform/projects/api/form/{recordID}`. Without a record ID, selection is stored only in the hidden field until the record exists.
- Known edge cases: Missing record ID for new tasks, JSON parsing errors in stored data, permissions blocking form query or save endpoint, large task lists affecting performance, auto-reload on submit/save interrupting edits, tasks without titles.

Testing checklist:
1. Open a Task and confirm the task list loads and search filters by ID or title.
2. Select multiple tasks and confirm they appear in the Selected panel.
3. Save and confirm indicator `17` contains JSON with task IDs and titles.
4. Clear selection and confirm indicator `17` is emptied.
5. Confirm the current task is not selectable as a dependency.

### Print View Customizations

#### print_form_iframe_project.tpl
- File path: `print_form_iframe_project.tpl`
- What was added/modified: Adds dependency table rendering for indicator `17` and ticket link rendering for indicator `18`; adds a MutationObserver to re-apply enhancements after print view content updates.
- Where it renders: Project request view in an iframe-based print view.
- Data dependencies: Indicator `17` (Dependencies) and indicator `18` (Ticket Import) are Task Form fields. The template reads indicator `17` and `18` in the Project request view.
- Dependencies source alignment: No sync exists between Task Form indicator `17` and the Project record. The dependencies table will only render if the Project record contains equivalent data for indicator `17`.
- How the dependencies table is populated: Parses indicator `17` value as JSON or HTML-encoded JSON, normalizes entries to `{id, title}`, and renders a table with links to `index.php?a=printview&recordID={id}`.
- Ticket import behavior: LEAF site detection uses relative paths, relying on the current site origin.
- Ticket import behavior: Source URL is constructed by regex match on indicator `18` text for `Support Ticket #` or `UX Ticket #`, then mapped to `/platform/support/index.php?a=printview&recordID=` or `/platform/ux/index.php?a=printview&recordID=`.
- Ticket import behavior: Indicator `18` display is replaced with a clickable link and `data-sandbox-url`; no write-back to the underlying field value is performed.
- Known limitations and safety checks: No link is created unless the text matches the expected pattern; dependency table rendering is skipped if parsing fails or no rows exist; guards prevent duplicate rendering.

Testing checklist:
1. Load a Project print view in iframe mode with a populated dependencies field and confirm a table renders.
2. Confirm dependency links open the correct print view.
3. Populate indicator `18` with `Support Ticket #XXX` and confirm it renders as a link.
4. Verify link opens in parent modal when embedded, or navigates directly when not embedded.

#### print_form_project.tpl
- File path: `print_form_project.tpl`
- What was added/modified: Adds dependency table rendering for indicator `17` and ticket link rendering for indicator `18`; adds a MutationObserver to re-apply enhancements after print view content updates and tab switches.
- Where it renders: Project request view in the standard print view.
- Data dependencies: Indicator `17` (Dependencies) and indicator `18` (Ticket Import) are Task Form fields. The template reads indicator `17` and `18` in the Project request view.
- Dependencies source alignment: No sync exists between Task Form indicator `17` and the Project record. The dependencies table will only render if the Project record contains equivalent data for indicator `17`.
- How the dependencies table is populated: Parses indicator `17` value as JSON or HTML-encoded JSON, normalizes entries to `{id, title}`, and renders a table with links to `index.php?a=printview&recordID={id}`.
- Ticket import behavior: LEAF site detection uses relative paths, relying on the current site origin.
- Ticket import behavior: Source URL is constructed by regex match on indicator `18` text for `Support Ticket #` or `UX Ticket #`, then mapped to `/platform/support/index.php?a=printview&recordID=` or `/platform/ux/index.php?a=printview&recordID=`.
- Ticket import behavior: Indicator `18` display is replaced with a clickable link and `data-sandbox-url`; no write-back to the underlying field value is performed.
- Known limitations and safety checks: No link is created unless the text matches the expected pattern; dependency table rendering is skipped if parsing fails or no rows exist; guards prevent duplicate rendering.

Testing checklist:
1. Load a Project print view and confirm the dependencies table renders when indicator `17` contains JSON.
2. Confirm dependency links open the correct print view.
3. Populate indicator `18` with `UX Ticket #XXX` and confirm it renders as a link.
4. Verify the link opens the modal in embedded contexts and navigates directly otherwise.

### Troubleshooting Guide
- Common symptoms: Selector lists are empty, selected values do not persist, dependencies table does not render, ticket links do not appear.
- Likely causes: Missing indicator elements, insufficient permissions to query forms, invalid JSON in dependencies field, selector scripts executing before fields render, iframe context assumptions not met, Project print view missing indicator `17` or `18` data.
- Debug steps: Confirm the target indicator input exists and matches the expected `name` attribute, inspect indicator values in the print view DOM, verify query responses in browser dev tools, and confirm MutationObserver callbacks are firing when print view content changes.

### Future Enhancements
- Harden selector bindings against delayed render and dynamic reflow.
- Refactor shared selector UI code into a reusable module.
- Add structured logging and feature flags for selector fetch, parse, render, and save stages.

## Design Implementation Notes

### UX strategy as implemented
- Priority on rapid scan of project status and task execution
- Analytics view emphasizes roll-ups and health indicators

### Accessibility implementation considerations
- ARIA roles and labels for tabs, panels, and menu controls
- Focus management and inert handling for modal interactions

### Information hierarchy decisions
- Projects and Tasks as primary operational views
- Analytics as a summary layer for portfolio-level signals

## Future Versioning

### Structured template for v7 and beyond
- Overview
- System purpose from a technical perspective
- Scope boundaries
- Current State (version-specific)
- Technical Architecture
- Embedded Logic Considerations
- Design Implementation Notes
- Change log and deprecations
