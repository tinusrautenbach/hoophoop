# Tasks: Scorer Page UX Improvements

**Input**: Design documents from `/specs/080-scorer-ux-improvements/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are included per constitution requirement V (Test Coverage for Business Logic).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Next.js project**: `src/`, `tests/` at repository root
- All changes are frontend-only in `src/components/scorer/` and `src/app/game/[id]/scorer/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared constants and types for touch targets and UI state

- [x] T001 Create touch target constants file at src/lib/constants/touch-targets.ts
- [x] T002 [P] Create LastScorerState type definition in src/lib/types/scorer-ui.ts
- [x] T003 [P] Create MutationFeedbackState type definition in src/lib/types/scorer-ui.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core UI state infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add lastScorer state to scorer page in src/app/game/[id]/scorer/page.tsx
- [x] T005 Add pendingMutations state to scorer page in src/app/game/[id]/scorer/page.tsx
- [x] T006 Create QuickRepeatButton component in src/components/scorer/quick-repeat-button.tsx
- [x] T007 [P] Create MutationFeedback component in src/components/scorer/mutation-feedback.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Fast Player Scoring (Priority: P1) 🎯 MVP

**Goal**: Reduce clicks from 3 to 2 for repeat scoring by same player

**Independent Test**: Score for a player, verify "Score Again" button appears, tap it, verify modal opens with player pre-selected

### Tests for User Story 1

- [ ] T008 [P] [US1] Create unit tests for QuickRepeatButton in tests/components/scorer/quick-repeat-button.test.tsx
- [ ] T009 [P] [US1] Create E2E test for quick-repeat flow in tests/e2e/scorer-ux.spec.ts

### Implementation for User Story 1

- [ ] T010 [US1] Extend ScoringModalProps to accept preSelectedPlayerId in src/components/scorer/scoring-modal.tsx
- [ ] T011 [US1] Add pre-selection logic to ScoringModal in src/components/scorer/scoring-modal.tsx
- [ ] T012 [US1] Integrate QuickRepeatButton into portrait layout in src/app/game/[id]/scorer/page.tsx
- [ ] T013 [US1] Integrate QuickRepeatButton into landscape layout in src/app/game/[id]/scorer/page.tsx
- [ ] T014 [US1] Add clear triggers for lastScorer state (substitution, timeout, period end) in src/app/game/[id]/scorer/page.tsx
- [ ] T015 [US1] Add visual feedback when quick-repeat button is tapped in src/components/scorer/quick-repeat-button.tsx

**Checkpoint**: User Story 1 complete - quick-repeat feature fully functional and testable

---

## Phase 4: User Story 2 - Touch Target Visibility (Priority: P1)

**Goal**: All interactive elements meet WCAG 2.5.5 minimum 44×44pt touch targets

**Independent Test**: Measure touch target sizes on mobile/tablet viewports, verify all meet minimums

### Tests for User Story 2

- [ ] T016 [P] [US2] Add touch target size tests to tests/e2e/scorer-ux.spec.ts

### Implementation for User Story 2

- [ ] T017 [P] [US2] Increase foul button padding from p-4 to p-6 in src/components/scorer/simple-scorer.tsx
- [ ] T018 [P] [US2] Increase game log action icons from size={12} to size={20} in src/components/scorer/game-log.tsx
- [ ] T019 [P] [US2] Add min-h-[32px] min-w-[32px] to game log action buttons in src/components/scorer/game-log.tsx
- [ ] T020 [P] [US2] Increase connection indicator from w-2 h-2 to w-3 h-3 (portrait) in src/app/game/[id]/scorer/page.tsx
- [ ] T021 [P] [US2] Increase connection indicator from w-1.5 h-1.5 to w-2 h-2 (landscape) in src/app/game/[id]/scorer/page.tsx
- [ ] T022 [US2] Add min-w-[48px] min-h-[48px] to period display button in src/app/game/[id]/scorer/page.tsx

**Checkpoint**: User Story 2 complete - all touch targets meet WCAG 2.5.5

---

## Phase 5: User Story 3 - Period and Clock Accessibility (Priority: P2)

**Goal**: Period and clock displays are immediately readable at a glance

**Independent Test**: Display scorer page at all orientations, verify text sizes meet minimums

### Tests for User Story 3

- [ ] T023 [P] [US3] Add period/clock legibility tests to tests/e2e/scorer-ux.spec.ts

### Implementation for User Story 3

- [ ] T024 [P] [US3] Increase period text from text-[10px] to text-sm (portrait) in src/app/game/[id]/scorer/page.tsx
- [ ] T025 [P] [US3] Increase period text from text-[8px] to text-xs (landscape) in src/app/game/[id]/scorer/page.tsx
- [ ] T026 [US3] Add visual feedback on period advance (brief highlight) in src/app/game/[id]/scorer/page.tsx

**Checkpoint**: User Story 3 complete - period and clock are legible at arm's length

---

## Phase 6: User Story 4 - Landscape Mode Optimization (Priority: P2)

**Goal**: Landscape layout is proportionally sized for comfortable tapping

**Independent Test**: Display on narrow landscape (< 600pt), verify all buttons are tappable

### Tests for User Story 4

- [ ] T027 [P] [US4] Add landscape layout tests for narrow devices to tests/e2e/scorer-ux.spec.ts

### Implementation for User Story 4

- [ ] T028 [P] [US4] Increase miss button opacity from opacity-60 to opacity-80 in src/app/game/[id]/scorer/page.tsx
- [ ] T029 [P] [US4] Add p-3 padding to miss buttons in landscape layout in src/app/game/[id]/scorer/page.tsx
- [ ] T030 [US4] Add conditional hiding of Box Score button on narrow landscape (< 600pt) in src/app/game/[id]/scorer/page.tsx
- [ ] T031 [US4] Increase game log limit from 10 to 12 items in landscape mode in src/app/game/[id]/scorer/page.tsx

**Checkpoint**: User Story 4 complete - landscape mode optimized for all device widths

---

## Phase 7: User Story 5 - Real-Time Sync Feedback (Priority: P3)

**Goal**: Scorers see visual feedback during scoring mutations

**Independent Test**: Simulate network delay, verify loading state appears on buttons

### Tests for User Story 5

- [ ] T032 [P] [US5] Create unit tests for MutationFeedback in tests/components/scorer/mutation-feedback.test.tsx
- [ ] T033 [P] [US5] Add mutation feedback E2E tests to tests/e2e/scorer-ux.spec.ts

### Implementation for User Story 5

- [ ] T034 [US5] Add mutation tracking to handleScore function in src/app/game/[id]/scorer/page.tsx
- [ ] T035 [US5] Add loading pulse animation to scoring buttons during mutation in src/app/game/[id]/scorer/page.tsx
- [ ] T036 [US5] Add success highlight animation after mutation completes in src/app/game/[id]/scorer/page.tsx
- [ ] T037 [US5] Add error toast for failed mutations in src/app/game/[id]/scorer/page.tsx
- [ ] T038 [US5] Add debounce (300ms) to scoring buttons to prevent rapid-tap duplicates in src/app/game/[id]/scorer/page.tsx

**Checkpoint**: User Story 5 complete - mutation feedback visible on all scoring actions

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] T039 [P] Run all unit tests and verify passing: npm run test
- [ ] T040 [P] Run E2E tests on mobile viewport: npm run test:e2e -- scorer-ux.spec.ts
- [ ] T041 Run quickstart.md validation scenarios
- [ ] T042 [P] Update AGENTS.md with new components and patterns
- [ ] T043 Final accessibility audit: verify all WCAG 2.5.5 touch targets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 - can proceed in parallel
  - US3 and US4 are both P2 - can proceed in parallel
  - US5 is P3 - can proceed after P1/P2 stories
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 5 (P3)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component creation before integration
- Integration before state management
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- T006 and T007 can run in parallel (different files)
- All tests within a user story marked [P] can run in parallel
- All touch target fixes (T017-T021) can run in parallel
- US1 and US2 can be worked on in parallel (both P1)
- US3 and US4 can be worked on in parallel (both P2)

---

## Parallel Example: User Story 1 + User Story 2 (Both P1)

```bash
# Launch tests for both stories together:
Task: "T008 [P] [US1] Create unit tests for QuickRepeatButton"
Task: "T009 [P] [US1] Create E2E test for quick-repeat flow"
Task: "T016 [P] [US2] Add touch target size tests"

# Launch touch target fixes in parallel:
Task: "T017 [P] [US2] Increase foul button padding"
Task: "T018 [P] [US2] Increase game log action icons"
Task: "T019 [P] [US2] Add min-h/min-w to game log buttons"
Task: "T020 [P] [US2] Increase connection indicator (portrait)"
Task: "T021 [P] [US2] Increase connection indicator (landscape)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Quick-Repeat)
4. Complete Phase 4: User Story 2 (Touch Targets)
5. **STOP and VALIDATE**: Test US1 and US2 independently
6. Deploy/demo if ready - MVP delivered!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + User Story 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 + User Story 4 → Test independently → Deploy/Demo
4. Add User Story 5 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Quick-Repeat)
   - Developer B: User Story 2 (Touch Targets)
   - Developer C: User Story 3 (Period/Clock)
3. Stories complete and integrate independently

---

## Summary

| Phase | Tasks | Parallel | Story |
|-------|-------|----------|-------|
| Setup | 3 | 2 | - |
| Foundational | 4 | 1 | - |
| User Story 1 | 8 | 2 | US1 |
| User Story 2 | 7 | 5 | US2 |
| User Story 3 | 4 | 1 | US3 |
| User Story 4 | 5 | 2 | US4 |
| User Story 5 | 7 | 2 | US5 |
| Polish | 5 | 3 | - |
| **Total** | **43** | **18** | - |

**MVP Scope**: Phase 1-4 (Setup + Foundational + US1 + US2) = 22 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence