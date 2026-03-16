# Tasks: Shot Ratio Display in Game Log

**Input**: Design documents from `/specs/079-shot-ratio-display/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Important**: The core implementation already exists in `src/components/scorer/game-log.tsx`. These tasks focus on test coverage and edge case fixes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify existing implementation and prepare test environment

- [X] T001 Verify existing implementation in `src/components/scorer/game-log.tsx` (lines 61-89 for `getShotRatio`, lines 152-157 for display)
- [X] T002 [P] Create test directory `src/components/scorer/__tests__/` if it doesn't exist
- [X] T003 [P] Create test directory `tests/e2e/` if it doesn't exist

---

## Phase 2: Foundational (Minor Fixes)

**Purpose**: Fix edge cases identified in research

**⚠️ CRITICAL**: These fixes should be applied before writing tests

- [X] T004 Fix chronology secondary sort in `src/components/scorer/game-log.tsx` line 68-69: Add `|| a.id.localeCompare(b.id)` for deterministic ordering when timestamps are equal

**Checkpoint**: Edge case fix complete - tests can now validate correct behavior

---

## Phase 3: User Story 1 - View Shot Ratio on Score Events (Priority: P1) 🎯 MVP

**Goal**: Verify that score events display correct cumulative shot ratios for each player

**Independent Test**: Create a game with multiple scoring events for a player, verify each score event displays correct (made/attempts) ratio

### Tests for User Story 1

- [X] T005 [P] [US1] Create unit test file `src/components/scorer/__tests__/game-log.test.ts` with test setup and helper function `createEvent()`
- [X] T006 [P] [US1] Add test case "returns null for non-score/miss events" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T007 [P] [US1] Add test case "returns null for events without player" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T008 [P] [US1] Add test case "returns (1/1) for first made shot" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T009 [P] [US1] Add test case "calculates cumulative ratio correctly for score events" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T010 [P] [US1] Add test case "separates ratios by shot type (1PT, 2PT, 3PT)" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T011 [US1] Run unit tests and verify all pass: `npm test -- game-log.test.ts`

### E2E Tests for User Story 1

- [X] T012 [US1] Create E2E test file `tests/e2e/shot-ratio.spec.ts` with Playwright setup
- [X] T013 [US1] Add E2E test "displays ratio on score events" in `tests/e2e/shot-ratio.spec.ts` — create game with score events, verify ratio displays
- [X] T014 [US1] Run E2E tests and verify: `npm run test:e2e -- shot-ratio`

**Checkpoint**: User Story 1 complete — score events show correct shot ratios

---

## Phase 4: User Story 2 - View Shot Ratio on Miss Events (Priority: P1)

**Goal**: Verify that miss events display correct cumulative shot ratios for each player

**Independent Test**: Create a game with miss events, verify each miss displays correct ratio including both made and missed attempts

### Tests for User Story 2

- [X] T015 [P] [US2] Add test case "returns (0/1) for first missed shot" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T016 [P] [US2] Add test case "calculates cumulative ratio correctly for mixed score/miss events" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T017 [P] [US2] Add test case "separates ratios by player" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T018 [US2] Run unit tests and verify all pass: `npm test -- game-log.test.ts`

### E2E Tests for User Story 2

- [X] T019 [US2] Add E2E test "displays ratio on miss events" in `tests/e2e/shot-ratio.spec.ts` — create game with miss events, verify ratio displays with correct made/attempts
- [X] T020 [US2] Run E2E tests and verify: `npm run test:e2e -- shot-ratio`

**Checkpoint**: User Story 2 complete — miss events show correct shot ratios

---

## Phase 5: User Story 3 - Real-Time Ratio Updates (Priority: P2)

**Goal**: Verify ratios update correctly when events are added, edited, or deleted

**Independent Test**: Add events, edit an event, delete an event, and verify all affected ratios update correctly

### Tests for User Story 3

- [X] T021 [P] [US3] Add test case "ratio updates when earlier event is deleted" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T022 [P] [US3] Add test case "ratio updates when new event is added" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T023 [P] [US3] Add test case "ratio updates chronologically — events are sorted by timestamp then id" in `src/components/scorer/__tests__/game-log.test.ts`
- [X] T024 [US3] Run unit tests and verify all pass: `npm test -- game-log.test.ts`

### E2E Tests for User Story 3

- [X] T025 [US3] Add E2E test "updates ratio when events are added" in `tests/e2e/shot-ratio.spec.ts`
- [X] T026 [US3] Add E2E test "updates ratio when events are deleted" in `tests/e2e/shot-ratio.spec.ts`
- [X] T027 [US3] Run E2E tests and verify: `npm run test:e2e -- shot-ratio`

**Checkpoint**: User Story 3 complete — ratios update in real-time

---

## Phase 6: Polish & Edge Cases

**Purpose**: Document edge cases and finalize implementation

### Spec Update (Team Filter Edge Case)

- [X] T028 Update assumption in `specs/079-shot-ratio-display/spec.md`: Change edge case "Ratio is calculated per player per team" to "Ratio accumulates across teams for same player (acceptable behavior — player switching teams mid-game is extremely rare)"

### Documentation

- [X] T029 [P] Update `specs/079-shot-ratio-display/quickstart.md` with final test commands
- [X] T030 [P] Run TypeScript type check: `npx tsc --noEmit` — verify no new errors
- [X] T031 Run full test suite: `npm test` — verify all existing tests still pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing implementation
- **Foundational (Phase 2)**: Depends on Setup — minor edge case fix
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - US1 and US2 can run in parallel (both P1)
  - US3 depends on US1 + US2 (tests cumulative behavior)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies
- **User Story 2 (P1)**: Can start after Phase 2 — No dependencies (parallel with US1)
- **User Story 3 (P2)**: Depends on US1 + US2 — Tests cumulative behavior

### Within Each Phase

- All tests marked [P] can run in parallel (different test cases)
- Run tests after all test cases for a story are written
- Verify tests pass before moving to next phase

---

## Parallel Example: User Stories 1 & 2

```bash
# Phase 3 & 4 can run in parallel (after Phase 2):
# Developer A: User Story 1 (score events)
Task: "Create unit test file with setup and helpers"
Task: "Add test cases for score events"
Task: "Add E2E test for score events"

# Developer B: User Story 2 (miss events)
Task: "Add test cases for miss events"
Task: "Add E2E test for miss events"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup (verify existing)
2. Complete Phase 2: Foundational (fix edge case)
3. Complete Phase 3: User Story 1 (score events)
4. Complete Phase 4: User Story 2 (miss events)
5. **VALIDATE**: All tests pass, score and miss events show correct ratios

### Full Feature (User Story 3)

6. Complete Phase 5: User Story 3 (real-time updates)
7. **VALIDATE**: Ratios update on add/edit/delete

### Polish

8. Complete Phase 6: Polish (edge cases, documentation)
9. **FINAL VALIDATION**: All tests pass, TypeScript clean

---

## Notes

- The core implementation already exists — these tasks are primarily for test coverage
- [P] tasks = different test cases, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable
- Verify tests fail before implementing (if implementing)
- Commit after each phase
- The spec edge case for team separation is intentionally NOT implemented — see T028