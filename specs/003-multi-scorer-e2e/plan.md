# Implementation Plan: End-to-End Multi-Scorer Browser Testing

**Branch**: `003-multi-scorer-e2e` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-multi-scorer-e2e/spec.md`

## Summary

Add Playwright E2E testing to simulate multiple concurrent users scoring the same live game via WebSockets. The suite will use `@clerk/testing` to provision test users and bypass UI login for fast, isolated browser contexts. Test data will be prefixed with `[E2E-TEST]` to allow pre-run cleanup scripts using Drizzle ORM to maintain database hygiene.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 15, Playwright (`@playwright/test`), Clerk (`@clerk/testing`), Drizzle ORM
**Storage**: PostgreSQL 16 (for cleanup script via `postgres-js`)
**Testing**: Playwright (E2E), replacing current Vitest-only setup for browser workflows
**Target Platform**: Web browsers (Chromium/WebKit/Firefox) simulating local server
**Project Type**: Next.js Web Application
**Performance Goals**: Full suite execution < 2 minutes
**Constraints**: Must run against real local stack (Postgres + Hasura + Next.js), Clerk authentication MUST bypass UI using testing tokens
**Scale/Scope**: ~3 E2E test files, new `tests/e2e` directory, test DB cleanup script

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Real-Time First**: E2E tests specifically validate that WebSocket propagation happens correctly end-to-end within 500ms (P1).
- **III. Data Integrity**: Implements `[E2E-TEST]` prefixing and pre-run sweep to ensure test data doesn't pollute the dev database. Cascade deletes are handled correctly by Drizzle.
- **IV. Permission Hierarchy**: Validates role enforcement (viewer vs scorer) end-to-end through real browser interactions.
- **V. Test Coverage**: Extends testing beyond Vitest unit/integration to full browser simulation.
- **VI. TypeScript Strict**: Playwright tests will be fully typed.
- **VII. Incremental Complexity**: Using official `@clerk/testing` package and standard Playwright setup. No unnecessary external test services.

All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/003-multi-scorer-e2e/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Quality validation
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
package.json                 # MODIFY: Add @playwright/test, @clerk/testing, update scripts
playwright.config.ts         # NEW: Playwright configuration
scripts/
└── cleanup-e2e.ts           # NEW: Drizzle script to delete [E2E-TEST] games
tests/
└── e2e/
    ├── helpers/
    │   └── auth.ts          # NEW: Clerk testing token injection helpers
    ├── multi-scorer.spec.ts # NEW: Concurrent scoring test
    └── roles.spec.ts        # NEW: Viewer vs Scorer enforcement test
TESTING.md                   # MODIFY: Document new E2E test workflow
```

**Structure Decision**: Playwright standard setup with a dedicated `tests/e2e` directory parallel to existing `tests/integration`. Database cleanup script placed in the existing `scripts/` directory alongside migrations.
