# Tasks: End-to-End Multi-Scorer Browser Testing

**Input**: Design documents from `/specs/003-multi-scorer-e2e/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, configure Playwright, and establish the test directory structure

- [x] T001 Add `@playwright/test` and `@clerk/testing` to devDependencies in `package.json`
- [x] T002 Add `test:e2e` script to `package.json` (`playwright test`) and `test:e2e:headed` (`playwright test --headed`)
- [x] T003 [P] Create `playwright.config.ts` at repo root — configure baseURL `http://localhost:3000`, timeout 30s, retries 2, reporters `['list']`, reference `globalSetup` pointing to `scripts/cleanup-e2e.ts`
- [x] T004 [P] Create `tests/e2e/` directory structure: `tests/e2e/helpers/` and `tests/e2e/__fixtures__/`

**Checkpoint**: `npx playwright --version` works; `tests/e2e/` directory exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user stories — cleanup script, auth helper, game fixture factory

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [x] T005 Create `scripts/cleanup-e2e.ts` — Drizzle script that hard-deletes all rows from `games` where `name LIKE '%[E2E-TEST]%'`; import `db` from `src/db` and `games` table from `src/db/schema`; export `cleanupE2EGames()` and call it when run directly via `tsx`
- [x] T006 Create `tests/e2e/helpers/auth.ts` — export `injectClerkSession(context: BrowserContext, userId: string): Promise<void>` that calls Clerk backend API to generate a testing token and injects the `__session` cookie into the Playwright `BrowserContext`; export `createTestUser(email: string, role: 'owner' | 'co_scorer' | 'viewer'): Promise<{ userId: string; cleanup: () => Promise<void> }>` using `@clerk/testing`
- [x] T007 Create `tests/e2e/helpers/game-factory.ts` — export `createE2EGame(ownerToken: string): Promise<{ gameId: string; cleanup: () => Promise<void> }>` that POSTs to `/api/games` with name prefixed `[E2E-TEST]` and returns gameId; export `inviteScorer(gameId: string, userId: string, role: 'co_scorer' | 'viewer', ownerToken: string): Promise<void>` that calls the existing scorer invite API

**Checkpoint**: `npx tsx scripts/cleanup-e2e.ts` runs without error; auth and game-factory helpers compile with `tsc --noEmit`

---

## Phase 3: User Story 1 — Two Scorers Scoring Simultaneously (Priority: P1) 🎯 MVP

**Goal**: Two isolated browser contexts score the same game simultaneously via WebSockets; both DOMs converge to the correct combined total within 2 seconds

**Independent Test**: `npx playwright test tests/e2e/multi-scorer.spec.ts` — all scenarios pass 100% of the time over 3 consecutive runs

- [x] T008 [US1] Create `tests/e2e/multi-scorer.spec.ts` — scaffold the file with `import { test, expect, chromium } from '@playwright/test'` and `import { createTestUser, injectClerkSession } from './helpers/auth'` and `import { createE2EGame } from './helpers/game-factory'`; add `test.beforeEach` / `test.afterEach` hooks to provision two test users (owner + co_scorer) and one E2E game, storing IDs in test-scoped state
- [x] T009 [US1] Implement scenario: **Simultaneous score updates converge** — open `contextA` and `contextB` with `browser.newContext()`, inject sessions, navigate both to `/game/[gameId]`, call `Promise.all([pageA.click('+2 Home'), pageB.click('+3 Guest')])`, then `await expect(pageA.locator('.home-score')).toHaveText('2', { timeout: 5000 })` and same for `pageB`; assert both pages agree on guest score `3` in `tests/e2e/multi-scorer.spec.ts`
- [x] T010 [US1] Implement scenario: **Foul recorded by Scorer A appears on Scorer B** — Scorer A records a foul for a home player, then assert `pageB.locator('[data-testid="home-fouls"]')` updates to reflect the new count within 5s in `tests/e2e/multi-scorer.spec.ts`
- [x] T011 [US1] Implement scenario: **Event deletion propagates across browsers** — Scorer A records a `+2 Home` event, waits for both pages to show `2`, Scorer A deletes the event, asserts both `pageA` and `pageB` show `0` within 5s in `tests/e2e/multi-scorer.spec.ts`

**Checkpoint**: All 3 scenarios in `multi-scorer.spec.ts` pass; concurrent score updates show correct arithmetic with no dropped events

---

## Phase 4: User Story 2 — Viewer vs Scorer Role Enforcement (Priority: P1)

**Goal**: Viewer browser context cannot see scoring controls; forced API calls from viewer are rejected 403 with no data corruption

**Independent Test**: `npx playwright test tests/e2e/roles.spec.ts` — all scenarios pass

- [x] T012 [US2] Create `tests/e2e/roles.spec.ts` — scaffold with imports and `test.beforeEach` / `test.afterEach` hooks that provision one owner user + one viewer user and one E2E game; invite viewer via `inviteScorer(gameId, viewerUserId, 'viewer', ownerToken)` in `beforeEach`
- [x] T013 [US2] Implement scenario: **Viewer sees no scoring controls** — inject viewer session into `contextViewer`, navigate to `/game/[gameId]`, assert `page.locator('[data-testid="score-btn"]')` has count 0 (or `isHidden()`), assert `page.locator('[data-testid="foul-btn"]')` has count 0, assert `page.locator('[data-testid="timer-control"]')` has count 0 in `tests/e2e/roles.spec.ts`
- [x] T014 [US2] Implement scenario: **Viewer API call is rejected while scorer scores** — open owner `contextOwner` and viewer `contextViewer` simultaneously; scorer records `+2 Home`; viewer's context performs `page.evaluate(() => fetch('/api/games/[gameId]/events', { method: 'POST', body: JSON.stringify({ type: 'SCORE', ... }) }))` and asserts the response status is `403`; assert owner's context still shows correct score (not corrupted) in `tests/e2e/roles.spec.ts`

**Checkpoint**: Role matrix (data-model.md) is fully exercised; viewer is blocked at both UI and API layer

---

## Phase 5: User Story 3 — Automated Setup and Teardown (Priority: P2)

**Goal**: `npx playwright test` on a fresh local environment runs end-to-end without manual intervention; database is clean after each run

**Independent Test**: Run `npx playwright test` after manually leaving orphan `[E2E-TEST]` games in the DB — confirm pre-run sweep removes them and tests pass

- [x] T015 [US3] Wire `globalSetup` in `playwright.config.ts` to call `cleanupE2EGames()` from `scripts/cleanup-e2e.ts` before any test runs; confirm orphaned games are deleted by logging the count of deleted rows
- [x] T016 [US3] Add `test.afterEach` teardown in both `multi-scorer.spec.ts` and `roles.spec.ts` that calls each fixture's `cleanup()` function (game deletion + Clerk user deletion) to leave the DB clean after each scenario
- [x] T017 [US3] Verify `playwright.config.ts` sets appropriate timeouts for full-stack local execution: `timeout: 30000` per test, `expect.timeout: 7000`, `actionTimeout: 10000`, `navigationTimeout: 15000` to account for Hasura/DB overhead

**Checkpoint**: After a full test run, zero `[E2E-TEST]` rows remain in `games`; a second `npx playwright test` run starts clean

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, environment validation, and developer ergonomics

- [x] T018 [P] Update `TESTING.md` — add an "E2E Tests" section documenting: prerequisites (local dev stack running), install command (`npm install`), browser install (`npx playwright install chromium`), run command (`npm run test:e2e`), headed mode (`npm run test:e2e:headed`), and the `[E2E-TEST]` prefix convention
- [x] T019 [P] Add a `playwright.config.ts` `webServer` config block (optional, commented out) that can launch `bun run dev` automatically via `start-server-and-test` for CI environments where the server isn't pre-started
- [x] T020 Run `npx tsc --noEmit` across the new files and fix any TypeScript strict-mode errors in `tests/e2e/` and `scripts/cleanup-e2e.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — no dependency on US2 or US3
- **User Story 2 (Phase 4)**: Depends on Phase 2 — no dependency on US1 or US3
- **User Story 3 (Phase 5)**: Depends on Phase 2 — integrates wiring from US1 & US2 files
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Fully independent after Phase 2
- **User Story 2 (P1)**: Fully independent after Phase 2 — shares auth/game-factory helpers only
- **User Story 3 (P2)**: Builds on the `beforeEach`/`afterEach` hooks already present in US1 and US2 files; adds `globalSetup` wiring

### Within Each User Story

- Helpers (T006, T007) before spec files
- Scaffold spec (T008, T012) before individual scenario tasks
- All scenario tasks within a story are independent of each other [P]

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T005, T006, T007 can run in parallel (different files, no shared deps)
- T009, T010, T011 can run in parallel (same file but different `test()` blocks — implement independently then merge)
- T013, T014 can run in parallel
- T018, T019, T020 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After T008 scaffold is merged:
Task T009: "Simultaneous score updates converge" scenario in multi-scorer.spec.ts
Task T010: "Foul propagation" scenario in multi-scorer.spec.ts
Task T011: "Event deletion propagation" scenario in multi-scorer.spec.ts
# All three scenarios implemented independently, merged into the same file
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (cleanup script + auth helper + game factory)
3. Complete Phase 3: User Story 1 (multi-scorer.spec.ts)
4. **STOP and VALIDATE**: `npx playwright test tests/e2e/multi-scorer.spec.ts` passes
5. Ship — concurrent WebSocket propagation is proven end-to-end

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. User Story 1 → concurrent scoring proven (MVP!)
3. User Story 2 → role enforcement proven
4. User Story 3 → teardown is bulletproof + CI-ready
5. Polish → docs + CI config

### Summary

| Metric | Value |
|--------|-------|
| Total tasks | 20 |
| Phase 1 (Setup) | 4 tasks |
| Phase 2 (Foundational) | 3 tasks |
| User Story 1 (P1) | 4 tasks |
| User Story 2 (P1) | 3 tasks |
| User Story 3 (P2) | 3 tasks |
| Polish | 3 tasks |
| Parallel opportunities | T003+T004, T005+T006+T007, T009+T010+T011, T013+T014, T018+T019+T020 |
| MVP scope | Phases 1–3 (11 tasks) |
