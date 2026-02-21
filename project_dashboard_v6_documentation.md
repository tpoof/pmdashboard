# LEAF Project Dashboard Documentation (project_v6)

## Overview
The LEAF Project Dashboard is a platform-level, cross-module surface that presents project health, progress, and risk signals in a consolidated view. This document reflects the current state of the dashboard at project_v6 and serves leadership and technical stakeholders.

## Purpose of the Project Dashboard
Provide a single, trustworthy, and role-appropriate view of project execution status, indicators, and cross-project roll-ups to support prioritization, governance, and operational decisions.

## Business Problem It Solves
- Reduces fragmented project visibility across modules and teams
- Enables early detection of project risk via indicator health signals
- Aligns stakeholders on standardized reporting and accountability

## Intended Users
- Executive leadership and portfolio owners
- Program and project managers
- Team leads and operational stakeholders
- Analysts and reporting stakeholders

## Relationship to LEAF Platform Modules (Projects, Tasks, Analytics)
- Projects: Primary source of project entities, metadata, and status
- Tasks: Feeds execution-level progress and completion signals
- Analytics: Provides roll-ups, indicator scoring, and trend signals

## Current State: project_v6 (Beta)
### Core Capabilities
- Portfolio-level dashboard with project list and high-level health indicators
- Project-level summary panels with key indicator roll-ups
- Standardized indicator health scoring and aggregation
- Role-aware visibility for sensitive or restricted indicators

### Primary UI Structure
- Header with global filters and time context
- Project list or grid with key status fields and indicator badges
- Project detail drawer or panel with roll-up summaries
- Analytics and indicator widgets aligned to project scope

### Key Workflows Supported
- Scan portfolio status and identify at-risk projects
- Drill into a project to review indicator health and drivers
- Apply filters to segment by owner, status, or timeframe
- Compare indicator roll-ups across projects

### Role-Based Visibility Behavior
- Indicators and project attributes are filtered by role permissions
- Restricted fields are hidden or masked based on access policies
- Aggregate roll-ups exclude restricted data from unauthorized viewers

### Analytics Roll-Ups and Indicator Health Scoring
- Indicator scores are aggregated at the project level
- Portfolio roll-ups summarize project health by category
- Health scoring uses weighted indicators and defined thresholds

### Known Constraints or Beta Limitations
- Some indicator mappings are incomplete or pending validation
- Performance may degrade on large portfolios without optimized filters
- Limited configurability of indicator thresholds in the UI
- Partial parity with legacy reporting views

## Technical Architecture
### File Structure and Naming Conventions
- Dashboard assets use the `project_dashboard_v6` naming convention
- Indicator configuration and roll-up logic follow module-scoped naming
- Analytics references align to project and indicator identifiers

### Front-End Stack (if applicable)
- Front-end stack is not specified in this document

### External Dependencies
- No external dependencies are documented in project_v6

### Indicator and Data Model Integration
- Project entities map to indicator definitions and scoring rules
- Indicator values are derived from project, task, and analytics sources
- Roll-ups are computed per project and summarized at portfolio level

### Data Flow Logic
- Project and task data feed indicator calculations
- Indicator scores aggregate into project health summaries
- Portfolio roll-ups aggregate project-level results

### Dashboard Interaction Patterns (modals, filtering, sorting, roll-ups)
- Filtering by status, owner, time range, and category
- Sorting by health score, status, or last updated
- Roll-up panels summarize indicator categories
- Modals or drawers used for project detail and indicator drill-in

### Performance Considerations
- Data fetching prioritizes portfolio summaries before drill-in detail
- Pagination or virtualized lists recommended for large portfolios
- Cached roll-ups reduce repeated computations

## Embedded Logic Considerations (Placeholder)
Additional logic exists in:
- Form field behaviors
- Auto-populated indicator fields
- `print_form` view logic

This logic will be documented in a separate technical companion file.

### Planned Technical Addendum: Form and Print View Logic
Documentation for form behaviors and `print_form` logic will be completed in a future version.

## Design Principles Applied
### UX Strategy
- Emphasize rapid scanning and exception-based attention
- Prioritize clarity of health signals over dense data tables

### Accessibility Considerations
- Color is not the sole indicator of health status
- Keyboard navigation and focus states are supported
- Text alternatives are provided for indicator badges

### Information Hierarchy and Scannability Decisions
- Primary health signals are surfaced above detailed metrics
- Consistent alignment of indicators across projects
- Progressive disclosure via drill-in panels

## Future Versioning
Version tracking begins at v6. v7 and beyond will be tracked in this document.

### Future Version Entry Template
- Version:
- Status:
- Release Date:
- Summary of Changes:
- Notable Impacts:
- Migration or Compatibility Notes:
