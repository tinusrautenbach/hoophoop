# Tasks: End-to-End Multi-Scorer Browser Testing

**Input**: Design documents from `/specs/003-multi-scorer-e2e/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Tests are INCLUDED as E2E testing is the primary deliverable of this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Playwright setup

- [X] T001 Add `@playwright/test` and `@clerk/testing` to devDependencies in `package.json`
- [X] T002 Add `test:e2e` and `test:e2e:headed` scripts to `package.json`
- [X] T003 [P] Create `playwright.config.ts` at repo root with baseURL, timeout, retries, and globalSetup config
- [X] T004 [P] Create `tests/e2e/` directory structure with `helpers/` and `__fixtures__/` subdirectories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story tests can run

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `scripts/cleanup-e2e.ts` Drizzle script to hard-delete games WHERE name LIKE '%[E2E-TEST]%'
- [X] T006 [P] Create `tests/e2e/helpers/auth.ts` with `injectClerkSession()` and `createTestUser()` functions using `@clerk/testing`
- [X] T007 [P] Create `tests/e2e/helpers/game-factory.ts` with `createE2EGame()` and `inviteScorer()` functions
- [X] T008 Wire `globalSetup` in `playwright.config.ts` to execute cleanup script before test runs

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Two Scorers Scoring Simultaneously in Real Browsers (Priority: P1) 🎯 MVP

**Goal**: Simulate two browser users scoring the same game simultaneously and verify WebSocket synchronization works end-to-end

**Independent Test**: Run `npx playwright test tests/e2e/multi-scorer.spec.ts` and verify all assertions pass including concurrent score updates

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `tests/e2e/multi-scorer.spec.ts` with test fixture to launch two isolated browser contexts
- [X] T010 [P] [US1] Implement `beforeEach` hook in `tests/e2e/multi-scorer.spec.ts` to provision two Clerk test users and create [E2E-TEST] game via API
- [X] T011 [US1] Write test in `tests/e2e/multi-scorer.spec.ts`: "concurrent scoring updates both browsers" - Scorer A clicks +2 Home, Scorer B clicks +3 Guest, both see 2-3 within 2 seconds
- [X] T012 [US1] Write test in `tests/e2e/multi-scorer.spec.ts`: "foul updates propagate via WebSocket" - Scorer A records player foul, Scorer B sees updated foul counts without refresh
- [X] T013 [US1] Write test in `tests/e2e/multi-scorer.spec.ts`: "event deletion syncs across browsers" - Scorer A deletes event, Scorer B's game log removes it and score recalculates
- [X] T014 [US1] Implement `afterEach` hook in `tests/e2e/multi-scorer.spec.ts` to cleanup test game data

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Viewer vs Scorer Role Enforcement (Priority: P1)

**Goal**: Verify that viewers cannot mutate game state through UI or API, and role restrictions are enforced end-to-end

**Independent Test**: Run `npx playwright test tests/e2e/roles.spec.ts` and verify viewer cannot interact with scoring controls and API rejects unauthorized requests

### Implementation for User Story 2

- [X] T015 [P] [US2] Create `tests/e2e/roles.spec.ts` with test fixture for owner/scorer and viewer user contexts
- [X] T016 [P] [US2] Implement `beforeEach` hook in `tests/e2e/roles.spec.ts` to create game with owner and invite viewer role via API
- [X] T017 [US2] Write test in `tests/e2e/roles.spec.ts`: "viewer sees read-only UI" - Navigate as viewer, assert score buttons and timer controls are disabled/hidden
- [X] T018 [US2] Write test in `tests/e2e/roles.spec.ts`: "viewer API requests are rejected" - Owner scores points, viewer attempts forced API call, assert 403 response and only owner points displayed
- [X] T019 [US2] Write test in `tests/e2e/roles.spec.ts`: "scorer can perform all mutations" - Owner context can add points, fouls, and delete events successfully
- [X] T020 [US2] Implement `afterEach` hook in `tests/e2e/roles.spec.ts` to cleanup role test data

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Automated Setup and Teardown for Local Dev (Priority: P2)

**Goal**: Provide seamless test execution with automatic provisioning, authentication, and cleanup for local development

**Independent Test**: Run `npx playwright test` on fresh environment and observe automatic user provisioning, game creation, execution, and cleanup without manual intervention

### Implementation for User Story 3

- [X] T021 [US3] Extend `tests/e2e/helpers/auth.ts` with `provisionTestUsers(count, roles)` function for batch user creation
- [X] T022 [US3] Extend `tests/e2e/helpers/game-factory.ts` with `createCompleteTestScenario()` that provisions users, creates game, and assigns roles
- [X] T023 [US3] Configure `playwright.config.ts` with project dependencies ensuring cleanup runs before tests
- [X] T024 [US3] Add `globalTeardown` to `playwright.config.ts` to cleanup any remaining [E2E-TEST] data after suite completion
- [X] T025 [US3] Write integration test in `tests/e2e/setup.spec.ts` validating full lifecycle: provision → authenticate → cleanup (fallback mechanism implemented in auth.ts)
- [X] T026 [US3] Add `test:e2e:ui` and `test:e2e:debug` scripts to `package.json` for headed mode and step-through execution

**Checkpoint**: All user stories should now be independently functional with automated setup/teardown

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

**Note on Test Users**: Tests use Clerk's testing API to dynamically create mock users with `+clerk_test@example.com` emails. No pre-existing test users required - the `createTestUser()` helper in `tests/e2e/helpers/auth.ts` handles user creation and cleanup automatically.

- [X] T027 [P] Update `TESTING.md` with E2E setup instructions, environment variables, and troubleshooting section
- [X] T028 [P] Add `webServer` config block (optional, commented out) to `playwright.config.ts` for CI environments
- [X] T029 [P] Add CI workflow configuration example in `.github/workflows/e2e.yml` for GitHub Actions
- [X] T030 Run `npx tsc --noEmit` across `tests/e2e/` and `scripts/cleanup-e2e.ts` and fix TypeScript strict-mode errors
- [X] T031 Add stress test script `test:e2e:stress` to run E2E suite 10 times (use `npm run test:e2e:stress` when dev server is running)
- [X] T032 Create environment validation script `scripts/validate-e2e-env.ts` with `npm run test:e2e:setup` command
- [X] T033 [P] Audit codebase for Convex and Socket.io remnants - search all files for `convex`, `socket.io`, `socketio`, `Socket.io` references and ensure only Hasura is used for realtime functionality
- [X] T034 [US1] Consolidate to single `game_events` table - update `hasura/metadata/databases/default/tables/game_events.yaml` to expose as `gameEvents` (not `gameEventsFull`) with matching GraphQL field names, then delete `hasura/metadata/databases/default/tables/hasura_game_events.yaml`
- [X] T035 [US1] Update `src/hooks/use-hasura-game.ts` to use consolidated `game_events` table - change subscription from `gameEvents` (hasura_game_events) to use `game_events` with correct column mappings (clock_at → clockAt, etc.)
- [X] T036 [US1] Create database migration to drop `hasura_game_events` table and migrate existing data to `game_events` in `drizzle/migrations/0017_consolidate_game_events.sql`
- [X] T037 [US1] Update REST API in `src/app/api/games/[id]/events/route.ts` to write to consolidated `game_events` table only (remove any dual writes)
- [X] T038 [US1] Re-enable T011 event deletion E2E test in `tests/e2e/multi-scorer.spec.ts` after table consolidation - verify event deletion syncs across browsers via WebSocket subscription
- [X] T039 [US1] Refactor game log page in `src/app/game/[id]/scorer/page.tsx` to use only Hasura subscription for events - remove initial REST API fetch, rely entirely on `gameEvents` from `useHasuraGame` hook
- [X] T040 [US1] Refactor full log page in `src/app/game/[id]/scorer/log/page.tsx` to use only Hasura subscription - remove dual-source approach where it fetches from REST API then overlays Hasura data
- [X] T041 [US1] Fix event deletion via GraphQL in `src/app/game/[id]/scorer/log/page.tsx` - currently uses `removeEvent` from `useHasuraGame` hook which calls Hasura mutation, verify it works with new schema
- [X] T042 [US1] Re-enable T011 test after game log refactor - verify event deletion propagates to scorer page via WebSocket
- [X] T043 [US1] Debug why game log doesn't load historical events on initial page load - check if REST API `/api/games/[id]` returns events and if they're properly mapped in `src/app/game/[id]/scorer/log/page.tsx`
- [X] T044 [US1] Ensure event deletion via Hasura mutation properly triggers WebSocket subscription update - verify `deleteGameEventsByPk` returns correct data for subscription to broadcast
- [X] T045 [US1] Add wait for events to load in T011 test - ensure game log page waits for events from either REST API or Hasura subscription before attempting deletion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - T005 depends on T001 (Drizzle dependencies)
  - T006, T007 depend on T001 (@clerk/testing, Playwright types)
  - T008 depends on T005 (cleanup script must exist)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - May reuse auth helpers from US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Builds on helpers from US1/US2 to enhance automation

### Within Each User Story

- Setup hooks (`beforeEach`) before any test cases
- Test cases can run in parallel if marked [P]
- Cleanup hooks (`afterEach`) after test cases complete
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 and US2 can start in parallel (both P1)
- Different test cases within a story marked [P] can run in parallel
- T027, T028, T029, T033 in Polish phase can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch test fixture setup:
Task: "Create tests/e2e/multi-scorer.spec.ts with test fixture to launch two isolated browser contexts"
Task: "Implement beforeEach hook in tests/e2e/multi-scorer.spec.ts to provision two Clerk test users and create [E2E-TEST] game via API"

# Once fixture ready, launch all tests for User Story 1 together:
Task: "Write test: 'concurrent scoring updates both browsers'"
Task: "Write test: 'foul updates propagate via WebSocket'"
Task: "Write test: 'event deletion syncs across browsers'"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `npx playwright test tests/e2e/multi-scorer.spec.ts` - verify all tests pass
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP achieved
3. Add User Story 2 → Test independently → Role security validated
4. Add User Story 3 → Test independently → Developer experience improved
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (concurrent scoring)
   - Developer B: User Story 2 (role enforcement) - shares auth helpers
   - Developer C: User Story 3 (automation) - builds on both
3. Stories complete and integrate independently

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 42 |
| Phase 1 (Setup) | 4 tasks |
| Phase 2 (Foundational) | 4 tasks |
| User Story 1 (P1) | 11 tasks |
| User Story 2 (P1) | 6 tasks |
| User Story 3 (P2) | 6 tasks |
| Polish | 7 tasks |
| Parallel opportunities | T003+T004, T006+T007, T009+T010, T015+T016, T027+T028+T029, T033, T034+T035+T036+T037 |
| MVP scope | Phases 1-3 (19 tasks) |
