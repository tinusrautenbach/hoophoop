# Tasks: Configurable Player Statistics

**Feature Branch**: `078-configurable-player-stats`  
**Source**: `.specify/memory/plan.md`, `.specify/memory/spec.md`, `data-model.md`, `contracts/`  
**Status**: ✅ **COMPLETED** - All 58 tasks implemented

**Tests**: Test tasks included for service-layer functions as required by constitution. UI tests optional.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Format Guide

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US1]**: Maps to User Story 1 (Configure Game Stats - P1)
- **[US2]**: Maps to User Story 2 (Multi-Scorer Stat Focus - P1)
- **[US3]**: Maps to User Story 3 (Stats Display and Aggregation - P2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and base infrastructure

- [x] T001 [P] Create stat type definitions enum in `src/types/stats.ts`
- [x] T002 [P] Create TypeScript interfaces for GameStatConfig, ScorerStatFocus, PlayerGameStats in `src/types/stats.ts`
- [x] T003 Add stat types barrel export in `src/types/index.ts`

**Checkpoint**: All type definitions complete and exported

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core utilities that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [x] T004 [P] Create `game_stat_configs` table migration in `drizzle/000X_add_game_stat_configs.sql`
- [x] T005 [P] Extend `game_events` table with audit fields (statType, modifiedBy, modifiedAt, version, previousVersion) in `drizzle/000X_extend_game_events.sql`
- [x] T006 [P] Extend `game_scorers` table with statFocus columns in `drizzle/000X_extend_game_scorers.sql`
- [x] T007 Update Drizzle schema definitions in `src/db/schema.ts` with new tables/columns
- [x] T008 Run migrations and verify schema in local database

### Core Utilities

- [x] T009 [P] Create stat type validation utilities in `src/lib/stats/stat-types.ts`
- [x] T010 [P] Create derived stat calculator (points_total, rebound_total) in `src/lib/stats/stat-calculator.ts`
- [x] T011 Create stat aggregation logic in `src/lib/stats/stat-aggregator.ts`

### Service Layer

- [x] T012 Create stat configuration service in `src/services/stats.ts`
- [x] T013 [P] Create unit tests for stat service in `src/services/__tests__/stats.test.ts`

**Checkpoint**: Database schema ready, migrations applied, core utilities tested

---

## Phase 3: User Story 1 - Configure Game Stats (Priority: P1) 🎯 MVP

**Goal**: Game creators can configure which statistics are tracked per game

**Independent Test**: Create a game, configure stats (enable points, disable rebounds), save, verify only enabled stats appear in scoring interface

### Tests for User Story 1

- [x] T014 [P] [US1] Unit test for stat configuration validation in `src/services/__tests__/stats.test.ts`
- [x] T015 [P] [US1] Unit test for inheritance resolution (community → season → game) in `src/services/__tests__/stats.test.ts`

### Implementation for User Story 1

#### API Layer

- [x] T016 [P] [US1] Implement GET /api/games/[id]/stat-config endpoint in `src/app/api/games/[id]/stat-config/route.ts`
- [x] T017 [US1] Implement POST /api/games/[id]/stat-config endpoint in `src/app/api/games/[id]/stat-config/route.ts`
- [x] T018 [P] [US1] Implement GET /api/games/[id]/stat-config/inheritance endpoint in `src/app/api/games/[id]/stat-config/inheritance/route.ts`

#### UI Components

- [x] T019 [P] [US1] Create StatConfigPanel component in `src/app/game/[id]/scorer/stat-config-panel.tsx`
- [x] T020 [P] [US1] Create StatToggle component in `src/components/scorer/stat-toggle.tsx`
- [x] T021 [US1] Add stat configuration UI to game settings page

#### Hooks

- [x] T022 [US1] Create useStatConfig hook in `src/hooks/use-stat-config.ts`

**Checkpoint**: User Story 1 complete - can create game, configure stats, see only enabled stats in UI

---

## Phase 4: User Story 2 - Multi-Scorer Stat Focus (Priority: P1)

**Goal**: Scorers can select 1-3 primary stats for quick access, all stats aggregate correctly

**Independent Test**: Two scorers join same game, set different focuses, record different stats simultaneously, verify both appear in game log and box score

### Tests for User Story 2

- [x] T023 [P] [US2] Unit test for scorer focus validation in `src/services/__tests__/stats.test.ts`
- [x] T024 [P] [US2] Unit test for stat event recording with audit trail in `src/services/__tests__/stats.test.ts`

### Implementation for User Story 2

#### API Layer

- [x] T025 [P] [US2] Implement GET /api/games/[id]/scorer-focus endpoint in `src/app/api/games/[id]/scorer-focus/route.ts`
- [x] T026 [US2] Implement POST /api/games/[id]/scorer-focus endpoint in `src/app/api/games/[id]/scorer-focus/route.ts`
- [x] T027 [P] [US2] Implement GET /api/games/[id]/scorer-focus/all endpoint in `src/app/api/games/[id]/scorer-focus/all/route.ts`
- [x] T028 [P] [US2] Implement global focus endpoints in `src/app/api/games/[id]/scorer-focus/global/route.ts`

#### UI Components

- [x] T029 [P] [US2] Create StatFocusSelector component in `src/app/game/[id]/scorer/stat-focus-selector.tsx`
- [x] T030 [P] [US2] Create StatButton component in `src/components/scorer/stat-button.tsx`
- [x] T031 [P] [US2] Create StatButtonGrid component in `src/components/scorer/stat-button-grid.tsx`
- [x] T032 [P] [US2] Create MoreStatsModal component in `src/app/game/[id]/scorer/more-stats-modal.tsx`
- [x] T033 [P] [US2] Create ScorerFocusIndicator component in `src/components/scorer/scorer-focus-indicator.tsx`

#### Hooks

- [x] T034 [US2] Create useScorerFocus hook in `src/hooks/use-scorer-focus.ts`
- [x] T035 [US2] Integrate stat focus into existing useHasuraGame hook

#### Event Recording

- [x] T036 [US2] Extend game event recording to support stat events with audit trail in `src/app/api/games/[id]/events/route.ts`
- [x] T037 [US2] Update Hasura game events subscription to include stat metadata in `src/hooks/use-hasura-game.ts`

**Checkpoint**: User Story 2 complete - multi-scorer setup works, stats aggregate correctly

---

## Phase 5: User Story 3 - Stats Display and Aggregation (Priority: P2)

**Goal**: Box score and player profiles show correctly aggregated stats from multiple scorers

**Independent Test**: Complete game with multiple scorers, view box score, verify all player stats correct, check season stats aggregate properly

### Tests for User Story 3

- [x] T038 [P] [US3] Unit test for player game stats aggregation in `src/services/__tests__/stats.test.ts`
- [x] T039 [P] [US3] Unit test for derived stat calculation in `src/lib/stats/__tests__/stat-calculator.test.ts`

### Implementation for User Story 3

#### Stats Aggregation

- [x] T040 [P] [US3] Create usePlayerStats hook in `src/hooks/use-player-stats.ts`
- [x] T041 [P] [US3] Create PlayerStats component in `src/components/scorer/player-stats.tsx`

#### Box Score

- [x] T042 [US3] Create BoxScore component with dynamic columns in `src/app/game/[id]/box-score/page.tsx`
- [x] T043 [US3] Add stat column visibility based on enabled stats
- [x] T044 [US3] Handle disabled stats (show N/A or hide column)

#### Game Log Updates

- [x] T045 [P] [US3] Update GameLog component to display stat events in `src/components/scorer/game-log.tsx`
- [x] T046 [P] [US3] Add audit trail indicator to game log entries

#### Player Profiles

- [x] T047 [US3] Update player profile stats endpoint to filter by tracked stats in `src/app/api/players/[id]/stats/route.ts`
- [x] T048 [US3] Update player profile UI to show per-game stat breakdowns in `src/app/players/[id]/page.tsx`

**Checkpoint**: User Story 3 complete - box score and profiles show correct aggregated stats

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect all user stories

### Performance & Optimization

- [x] T049 [P] Optimize stat aggregation with memoization in `src/lib/stats/stat-aggregator.ts`
- [x] T050 [P] Add React.memo to StatButton components for render optimization

### Mobile Responsiveness

- [x] T051 [P] Verify 320px minimum width support for stat button grid
- [x] T052 [P] Ensure 48×48px touch targets for all stat buttons

### Error Handling

- [x] T053 Add error boundaries for stat configuration components
- [x] T054 Add graceful degradation when Hasura subscription fails

### Documentation

- [x] T055 Update API documentation with new endpoints
- [x] T056 Add JSDoc comments to all stat utility functions

### Testing

- [x] T057 Run quickstart.md validation scenarios
- [x] T058 Verify constitution compliance (TypeScript strict, no escape hatches)

**Final Checkpoint**: All features complete, tested, and documented

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Phase 1 (Setup)**: No dependencies - can start immediately
2. **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
3. **Phase 3 (US1)**: Depends on Phase 2 - Can start after foundation
4. **Phase 4 (US2)**: Depends on Phase 2 and Phase 3 (uses stat config) - Can start after US1 or in parallel with US1 core
5. **Phase 5 (US3)**: Depends on Phase 2 and Phase 4 (uses stat events) - Can start after US2
6. **Phase 6 (Polish)**: Depends on all user stories

### User Story Dependencies

- **US1 (Configure Game Stats)**: No dependencies on other stories - outputs stat configuration
- **US2 (Multi-Scorer Focus)**: Depends on US1 (needs stat config to know which stats are available) - can start after US1 database/API complete
- **US3 (Display & Aggregation)**: Depends on US2 (needs stat events to aggregate) - can start after US2 event recording complete

### Within Each Phase

- Tasks marked [P] can run in parallel
- Database migrations (T004-T008) have internal dependencies (create tables before extending)
- API endpoints (T016-T018) can run in parallel after service layer (T012)
- UI components (T019-T021) can run in parallel after hooks (T022)

### Parallel Execution Examples

```bash
# Phase 2 parallel tasks:
- T004: Create game_stat_configs table
- T005: Extend game_events table
- T006: Extend game_scorers table
- T009: Create stat type utilities
- T010: Create derived stat calculator

# Phase 3 (US1) parallel tasks after Phase 2:
- T016: GET stat-config endpoint
- T017: POST stat-config endpoint
- T019: StatConfigPanel component
- T020: StatToggle component

# Phase 4 (US2) parallel tasks after US1:
- T025: GET scorer-focus endpoint
- T026: POST scorer-focus endpoint
- T029: StatFocusSelector component
- T030: StatButton component
- T031: StatButtonGrid component
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total Tasks** | 58 |
| **Phase 1 (Setup)** | 3 |
| **Phase 2 (Foundational)** | 10 |
| **Phase 3 (US1 - Configure)** | 12 |
| **Phase 4 (US2 - Multi-Scorer)** | 15 |
| **Phase 5 (US3 - Display)** | 11 |
| **Phase 6 (Polish)** | 7 |

### Parallel Opportunities

- **High Parallelism**: Phase 1 (T001-T003), Phase 2 migrations (T004-T006), Phase 2 utilities (T009-T011)
- **Medium Parallelism**: API endpoints within each story, UI components within each story
- **Sequential**: US1 → US2 → US3 (each builds on previous)

### MVP Scope

Focus on **User Story 1 + User Story 2 core**:
1. Complete Phase 1 and Phase 2 (foundation)
2. Complete US1: Configure game stats
3. Complete US2: Multi-scorer focus and event recording
4. Basic box score display (subset of US3)

This delivers the core value: configurable stats with multi-scorer support.

### Implementation Strategy

**Incremental Delivery**:
1. Foundation (Phase 1-2) → Database ready
2. US1 → Can configure stats
3. US2 → Can score with multiple scorers
4. US3 → Full box score and profiles
5. Polish → Optimization and documentation

Each increment adds value and can be deployed independently.

---

*Generated from speckit-tasks workflow*  
*Date: 2026-03-05*
