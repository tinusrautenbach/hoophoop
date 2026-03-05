---
description: "Task list for Multi-Scorer Concurrent Testing & Fixes"
---

# Tasks: Multi-Scorer Concurrent Testing & Fixes

**Input**: Design documents from `/specs/002-multi-scorer-testing/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Test tasks are included as requested by the feature specification (T099-T108).
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact absolute file paths are provided.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create `src/app/api/games/[id]/recalculate/route.ts` API endpoint boilerplate
- [x] T002 Create `src/components/scorer/recalc-toast.tsx` component file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement `recalculateGameTotals` function in `src/services/game.ts` using SQL `SUM`/`COUNT` on `gameEvents`
- [x] T004 Add test helpers `buildDriftedGameState`, `buildRecalcMock`, `assertScoreIntegrity` in `src/lib/hasura/__tests__/test-utils.ts`
- [x] T005 Implement `POST` handler in `src/app/api/games/[id]/recalculate/route.ts` that calls `recalculateGameTotals`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Concurrent Score Updates Produce Correct Totals (Priority: P1) 🎯 MVP

**Goal**: Fix PATCH event amendment score recalculation bug and ensure concurrent scoring logic produces mathematically correct totals equal to the sum of all individual score events.

**Independent Test**: Simulate two scorer sessions posting events within milliseconds and verify final displayed totals equal the sum of all events.

### Tests for User Story 1 (OPTIONAL) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Add test T099 for PATCH event amendment recalculation in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T007 [P] [US1] Add integration test for PATCH recalculation regression (Bug-3) in `src/hooks/__tests__/regression.test.ts`
- [x] T008 [P] [US1] Add test T108 for force-recalc during concurrent updates (3+ scorers) in `tests/load/concurrent-scorers.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Fix PATCH handler in `src/app/api/games/[id]/events/route.ts` (lines 203-258) to use reverse-old/apply-new logic for score/foul amendments
- [x] T010 [US1] Add sync to Hasura via `UPSERT_GAME_STATE_MUTATION` with incremented version in `src/app/api/games/[id]/events/route.ts` PATCH handler

**Checkpoint**: At this point, User Story 1 (PATCH recalculation and basic concurrency fixes) should be functional and testable.

---

## Phase 4: User Story 6 - Score Integrity via Full Recalculation at Key Moments (Priority: P1)

**Goal**: Periodically verify score integrity by performing full recalculation from game events at defined triggers (period change, halftime, game finalization, timeout, reconnection). Add a manual force-recalc button and discrepancy logging/toast notification.

**Independent Test**: Introduce intentional drift between cached totals and true event sums, trigger a recalculation event, and verify totals are corrected and discrepancy is logged/notified.

### Tests for User Story 6 (OPTIONAL) ⚠️

- [x] T011 [P] [US6] Add test T100 for full recalculation at period change in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T012 [P] [US6] Add test T101 for full recalculation at game finalization in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T013 [P] [US6] Add test T103 for manual force-recalc button in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T014 [P] [US6] Add test T104 for discrepancy detection logging and toast notification in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T020 [P] [US6] Add test T102 for WebSocket reconnection triggering full recalculation in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`

### Implementation for User Story 6

- [x] T015 [P] [US6] Build `recalc-toast.tsx` component in `src/components/scorer/recalc-toast.tsx` with auto-dismiss after 5 seconds
- [x] T016 [US6] Integrate `recalc-toast.tsx` into `src/app/game/[id]/scorer/page.tsx`
- [x] T017 [US6] Add manual force-recalc button to scorer top header in `src/app/game/[id]/scorer/page.tsx` triggering POST to `/api/games/[id]/recalculate`
- [x] T018 [US6] Hook up recalculation triggers before period change (`nextPeriod()`) and game finalization (`handleEndGame()`) in `src/app/game/[id]/scorer/page.tsx`
- [x] T019 [US6] Log discrepancy details (old vs new values, trigger type, game ID) in `src/services/game.ts` `recalculateGameTotals` when `corrected=true`

**Checkpoint**: At this point, User Stories 1 and 6 should both work independently.

---

## Phase 5: User Story 2 - Frontend State Consistency Across Scorer Sessions (Priority: P1)

**Goal**: Ensure all connected scorer interfaces update to reflect the latest game state (including deletions, amendments, and reconnections) without manual refresh.

**Independent Test**: Render multiple simulated scorer sessions, push state updates from one, and assert all others reflect the changes. Reconnect a dropped session and verify it catches up.

### Tests for User Story 2 (OPTIONAL) ⚠️

- [x] T020 [P] [US2] Add test T102 for reconnection triggering full recalculation in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T021 [P] [US2] Add test T107 for rapid-fire updates (10+/sec) processed without drops in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Add WebSocket reconnect handler in `src/hooks/use-hasura-game.ts` to trigger full recalculation (`recalculateGameTotals`)

**Checkpoint**: User Story 2 is fully testable and frontend sync logic is robust.

---

## Phase 6: User Story 3 - Conflict Detection and User Feedback (Priority: P2)

**Goal**: Verify version-based conflict detection, automatic retries, and visible conflict indicators when automatic retries are exhausted.

**Independent Test**: Force a version mismatch in the update mechanism and verify the retry succeeds or the conflict indicator appears.

### Tests for User Story 3 (OPTIONAL) ⚠️

- [x] T023 [P] [US3] Verify existing T-series tests adequately cover automatic retries and conflict indicator display/clear logic in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`

### Implementation for User Story 3

- [x] T024 [P] [US3] Review and verify `conflictDetected` state pattern in `src/app/game/[id]/scorer/page.tsx` matches spec requirements (no new code needed if already compliant).

**Checkpoint**: Conflict detection is verified.

---

## Phase 7: User Story 4 - Timer Synchronisation Under Concurrent Control (Priority: P2)

**Goal**: Ensure timer state remains consistent and deterministic when multiple scorers start/stop the clock concurrently.

**Independent Test**: Simulate two scorers issuing start and stop commands concurrently and verify the timer does not double-count elapsed time.

### Tests for User Story 4 (OPTIONAL) ⚠️

- [x] T025 [P] [US4] Verify existing T-series tests adequately cover timer start/stop race conditions in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`

### Implementation for User Story 4

- [x] T026 [US4] Hook up recalculation trigger after timeout recorded in `updateTimeouts()` within `src/hooks/use-hasura-game.ts`

**Checkpoint**: Timer sync and timeout recalculation triggers are complete.

---

## Phase 8: User Story 5 - Foul and Stat Tracking Under Concurrent Updates (Priority: P3)

**Goal**: Verify foul and player stat accuracy under concurrent updates and ensure deletions correctly decrement associated totals. Ensure role-based access controls block unauthorized mutations.

**Independent Test**: Simulate concurrent foul recordings for players, verifying individual/team foul counts. Test role enforcement (viewer, co_scorer).

### Tests for User Story 5 (OPTIONAL) ⚠️

- [x] T027 [P] [US5] Add test T105 verifying viewers cannot mutate game state under load in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T028 [P] [US5] Add test T106 verifying co_scorers can score but not manage scorers in `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
- [x] T029 [P] [US5] Add integration tests in `tests/load/concurrent-scorers.test.ts` verifying role enforcement (viewer rejection) under high concurrent load

### Implementation for User Story 5

- [x] T030 [US5] Verify `canManageGame` checks in `src/app/api/games/[id]/recalculate/route.ts` and event routes properly reject viewers and restrict co_scorers according to `gameScorers` roles.

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T031 [P] Run linter and formatter over all modified `src/` and `tests/` files
- [x] T032 Verify test suite completes in under 60 seconds (SC-006)
- [x] T033 Code cleanup and refactoring in `src/services/game.ts` and `src/app/api/games/[id]/events/route.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (PATCH fix) should run first as it fixes the core data integrity issue
  - US6 (Full Recalc Triggers) relies on US1's completion to ensure the core logic is sound
  - US2, US3, US4, US5 can proceed in parallel once Foundation is complete
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies
- **User Story 6 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2)

### Within Each User Story

- Tests (T099-T108) MUST be written and FAIL before implementation
- Services (`recalculateGameTotals`) before API endpoints
- API endpoints before UI integration (`force-recalc` button)
- Core implementation before integration

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Once Foundational phase completes, test generation (T006-T008, T011-T014, T020-T021, T027-T029) can proceed in parallel
- UI component creation (`recalc-toast.tsx` T015) can run in parallel with API fixes

---

## Implementation Strategy

### MVP First (User Story 1 & 6 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (PATCH recalculation fix)
4. Complete Phase 4: User Story 6 (Full recalculation triggers and UI button)
5. **STOP and VALIDATE**: Test User Stories 1 & 6 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 & 6 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (Reconnection handling) → Test independently → Deploy/Demo
4. Add User Stories 3 & 4 (Conflict detection review, Timer timeout recalc) → Test independently
5. Add User Story 5 (Role testing under load) → Test independently
6. Each story adds value without breaking previous stories
