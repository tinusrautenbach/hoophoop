# Tasks: Phase 6 - Season Statistics & Phase 20 - Platform Gaps

**Input**: `.specify/memory/spec.md`, `.specify/memory/plan.md`
**Generated**: 2026-03-07
**Branch**: `003-phase-14-20-improvements`

**Organization**: Tasks grouped by capability area to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **Path Conventions**: All paths relative to repo root (`src/`, `drizzle/`)

---

## Phase 1: Setup — No Outstanding Work

> Platform infrastructure is complete. Tasks below cover specific feature improvements only.

---

## Phase 2: Season Statistics Foundation (Phase 6.2)

**Purpose**: Add season-level statistics aggregation to enable season-over-season player/team comparison. This unblocks player retention features and seasonal competition tracking.

**Status**: ⚠️ **PARTIALLY COMPLETE** — Game-level stats exist; season aggregation missing.

**⚠️ CRITICAL**: Without season-level stats, players cannot track improvement across seasons and teams cannot compare performance year-over-year.

### Implementation for Season Statistics

- [ ] T001 [US6] Add `seasonId` column to `athletes` table in `drizzle/0000XXX_add_seasonid_to_athletes.sql`
- [ ] T002 [US6] Add `seasonId` column to game_rosters table in `drizzle/0000XXX_add_seasonid_to_game_rosters.sql`  
- [ ] T003 [US6] Create `seasonStats` aggregate view in `drizzle/0000XXX_create_season_stats_view.sql` (PPG, FPG, W/L per team per season)
- [ ] T004 [US6] Create `athleteSeasonStats` aggregate view joining game_events with seasons table
- [ ] T005 [US6] Implement GET `/api/seasons/[id]/stats` endpoint returning aggregated season statistics
- [ ] T006 [US6] Implement GET `/api/players/[id]/seasons` endpoint returning career stats grouped by season
- [ ] T007 [US6] Add season comparison UI to player profile page showing stat trends over years
- [ ] T008 [US6] Update team stats page to show season-over-season performance comparison

**Checkpoint**: Verify that season statistics aggregate correctly by comparing manual calculations against view outputs.

---

## Phase 3: Multi-Scorer UI Improvements (Phase 20)

**Purpose**: Complete the multi-scorer user experience — presence indicators, conflict notifications, and activity attribution (API-level work is done; UI is missing).

**Status**: ⚠️ **UI MISSING** — Backend supports multiple scorers; frontend lacks presence and conflict visibility.

**Independent Test**: Open the same game in two browser tabs as two different scorers. Verify both scorers see each other's presence badge, see the scorer name on each game log event, and see a conflict toast when they both act simultaneously.

### Sub-Tasks

- [ ] T009 [US20] Create `ScorerPresenceIndicator` component showing active scorers with avatars/names in `src/components/scorer/scorer-presence-indicator.tsx`
- [ ] T010 [US20] Subscribe to `gamePresence` table via Hasura to get real-time active scorer list
- [ ] T011 [US20] Add presence badge to `src/app/game/[id]/scorer/page.tsx` header/footer
- [ ] T012 [US20] Display `createdBy` user display name (via Clerk or users table) in game log event items
- [ ] T013 [US20] Create `ConflictNotification` UI component for simultaneous action detection
- [ ] T014 [US20] Emit conflict events when two scorers act within 200ms window (client-side detection)
- [ ] T015 [US20] Show toast notification when conflict detected: "Other scorer acted first" or "Actions may conflict"
- [ ] T016 [US20] Implement optimistic concurrency control UI feedback (spinner/retry on version conflict)

**Checkpoint**: Verify conflict detection and notification by performing simultaneous actions from two browser tabs.

---

## Phase 4: Team & Game UX Enhancements (Phase 20)

**Purpose**: Improve team creation and game export workflows with user-friendly features.

**Status**: ⚠️ **PARTIAL / MISSING** — Bulk roster paste exists; color picker and HTML export need completion.

### Team Creation

- [ ] T017 [US20] Add visual color picker to team creation/edit form using `react-color` or `@uiw/react-color` in `src/components/team/team-color-picker.tsx`
- [ ] T018 [US20] Update team color picker with hex input, gradient preview, and save to `teams.name` metadata
- [ ] T019 [US20] Add color preview thumbnail to team selection dropdown in game creation flow

### Game Export

- [ ] T020 [US20] Create server-side HTML export function in `src/server/game-export.ts` using `node-html-builder` or similar
- [ ] T021 [US20] Implement GET `/api/games/[id]/export` endpoint returning HTML file
- [ ] T022 [US20] Design HTML template for box score + play-by-play with responsive styling in `src/templates/game-export.html`
- [ ] T023 [US20] Add "Export HTML" button to game spectator page (`/game/[id]`) 
- [ ] T024 [US20] Add "Export HTML" button to game log page (`/game/[id]/log`)
- [ ] T025 [US20] Validate generated HTML exports by opening in Chrome/Firefox and verifying formatting

**Checkpoint**: Verify HTML export includes all game events, scores, box score tables, and play-by-play log.

---

## Phase 5: Shot Charting (Phase 3/Phase 20 gap)

**Purpose**: Enhance player shot visualization for coaching insights and player development.

**Status**: ⚠️ **MISSING** — Basic stat tracking exists; shot charting not implemented.

### Shot Charting

- [ ] T026 [US20] Create `ShotChart` component with court visualization in `src/components/stats/shot-chart.tsx`
- [ ] T027 [US20] Add `shotData` metadata to game_events table (x/y coordinates, shot type) via migration in `drizzle/0000XXX_add_shot_data_to_game_events.sql`
- [ ] T028 [US20] Implement shot recording UI in scorer overlay (make/miss selector with court tap)
- [ ] T029 [US20] Render made/missed shot dots on court visualization with color coding (red = miss, green = make)
- [ ] T030 [US20] Add shot chart heat map overlay showing shot density by zone
- [ ] T031 [US20] Display shot chart in player box score sidebar and player profile page
- [ ] T032 [US20] Add shot chart filters (period, player, shot type) to stats view

**Checkpoint**: Verify shot data persists correctly and visualizes with proper court orientation and shot type differentiation.

---

## Phase 6: Polish & Integration

**Purpose**: Ensure all Phase 6 and Phase 20 improvements integrate seamlessly with existing platform.

- [ ] T033 [P] Add TypeScript types for season stats views in `src/types/season-stats.ts`
- [ ] T034 [P] Add TypeScript types for scorer presence data in `src/types/scorer-presence.ts`
- [ ] T035 [US6] Add integration test for season stats aggregation accuracy in `src/hooks/__tests__/use-season-stats.test.ts`
- [ ] T036 [US20] Add integration test for multi-scorer presence indicators in `src/hooks/__tests__/use-scorer-presence.test.ts`
- [ ] T037 [US20] Add integration test for conflict notification UI in `src/components/__tests__/conflict-notification.test.tsx`
- [ ] T038 [US20] Add integration test for HTML export functionality in `src/services/__tests__/game-export.test.ts`
- [ ] T039 [US20] Run `npm test && npm run lint` to verify no regressions
- [ ] T040 [US20] Document new endpoints in `docs/api/phases-6-and-20.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Season Statistics (Phase 2)**: No dependencies — can start immediately with database migrations first
- **Multi-Scorer UI (Phase 3)**: Depends on `gamePresence` table (already exists in Hasura metadata from Phase 18)
- **Team & Game UX (Phase 4)**: No dependencies — independent features
- **Shot Charting (Phase 5)**: Depends on shot data schema extension
- **Polish (Phase 6)**: Depends on all above phases completion

### Parallel Opportunities

- **Phase 2 (Season Stats)**:
  - T001-T004: Database migrations (sequential: must complete before queries)
  - T005-T006: API endpoints (can run in parallel after T004)
  - T007-T008: UI components (can run in parallel after T005-T006)

- **Phase 3 (Multi-Scorer UI)**:
  - T009-T011: Presence indicators (can run in parallel)
  - T012: Activity attribution (depends on T009)
  - T013-T016: Conflict notification (can run in parallel after T012)

- **Phase 4 (Team & Game UX)**:
  - T017-T019: Color picker (all parallel)
  - T020-T025: HTML export (sequential: T020→T021→T022→T023-T025)

- **Phase 5 (Shot Charting)**:
  - T026-T027: Schema + component (can run in parallel)
  - T028-T030: Shot recording UI (depends on T027)
  - T031-T032: Display integration (can run in parallel after T028-T030)

### Minimum Viable Progression

1. **MVP 1**: Phase 2 (Season Statistics) — Independent MVP delivering player season tracking
2. **MVP 2**: Phase 4.1 (Color Picker) — Small, high-value team creation enhancement
3. **MVP 3**: Phase 3 (Multi-Scorer UI) — Completes existing multi-scorer backend with UI
4. **MVP 4**: Phase 4.2 (HTML Export) — Standalone export feature
5. **MVP 5**: Phase 5 (Shot Charting) — Advanced coaching insights feature

---

## Implementation Strategy

### MVP First (Season Statistics)

1. Complete Phase 2 (Tasks T001-T008)
2. **STOP and VALIDATE**: Test player profile displays seasonal stats correctly
3. Deploy MVP 1 if ready
4. Return to Phase 20 tasks

### Incremental Delivery Timeline

**Week 1**: Season Statistics (Phase 2)
- DB migrations + aggregated views
- API endpoints for season stats
- Player profile seasonal comparison

**Week 2**: Multi-Scorer UI (Phase 3)
- Presence indicators
- Activity attribution in game log
- Conflict notification system

**Week 3**: Team & Utility Features (Phase 4)
- Color picker for teams
- HTML export functionality

**Week 4**: Shot Charting (Phase 5)
- Shot data schema
- Shot recording UI
- Visualizations

**Week 5**: Polish & Testing (Phase 6)
- Integration tests
- Documentation
- Final validation

---

## Notes

- **Bulk roster paste** (T035 reference) — Already exists in `src/components/scorer/bench-selection.tsx` (lines 13-42)
- **Optimistic concurrency control** (T016) — Backend already implements version field (Phase 18); UI feedback missing
- **gamePresence table** — Already exists in Hasura metadata export from Phase 18 (`021-hasura-metadata-multiscorer-ui`)
- **TypeScript Strict** — All new code must comply with no `as any` / `@ts-ignore` requirement
- **Clerk Integration** — Use Clerk's user API to fetch display names for `createdBy` field

---

## Total Task Summary

- **Total Tasks**: 40
- **Phase 2 (Season Statistics)**: 8 tasks
- **Phase 3 (Multi-Scorer UI)**: 8 tasks
- **Phase 4 (Team & Game UX)**: 9 tasks
- **Phase 5 (Shot Charting)**: 7 tasks
- **Phase 6 (Polish & Integration)**: 8 tasks
- **Tasks Already Complete**: Bulk roster paste validation (bench-selection.tsx exists)

---

## Independent Test Criteria

### Phase 2 — Season Statistics
1. Create a season, add 5 games with varying scores
2. Verify `/api/seasons/[id]/stats` returns accurate PPG/FPG/W-L
3. Verify player profile shows season-over-season career progression
4. Verify team stats page compares two seasons side-by-side

### Phase 3 — Multi-Scorer UI
1. Open game in two tabs as different scorers
2. Verify badges show active scorers with names
3. Verify game log shows "Recorded by [User}" on each event
4. Simultaneously submit two events; verify conflict toast appears

### Phase 4 — Team & Game UX
1. Create team with color picker; verify hex code saves correctly
2. Open exported HTML file; verify all content displays correctly
3. Verify export includes box score, play-by-play, and team totals

### Phase 5 — Shot Charting
1. Record 10 shots with coordinates; verify shot dots appear on court
2. Verify heat map correctly displays shot density
3. Verify chart filters work (period, player, shot type)
