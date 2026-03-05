# Tasks: HoopHoop Basketball Scoring Platform — Outstanding Work

**Input**: `.specify/memory/spec.md`, `.specify/memory/plan.md`, `spec/outstanding_tasks.md`, `spec/implementation_plan.md`
**Generated**: 2026-02-28
**Status**: Platform-wide outstanding task breakdown (Phases 1–19 complete; below = remaining work)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (US1–US7)
- All paths relative to repo root

---

## Phase 1: Setup — No Outstanding Work

> Phases 1–13, 15 (core), 16, 18 (core), 19 are complete. Tasks below cover outstanding items only.

---

## Phase 2: Foundational — Hasura Metadata Completeness (Phase 18 Remainder) ✅

**Purpose**: Complete Hasura metadata tracking so all tables are queryable/subscribable. This unblocks real-time features across all user stories.

**Status**: ✅ **COMPLETED** in branch `021-hasura-metadata-multiscorer-ui`

**⚠️ CRITICAL**: Until remaining tables are tracked in Hasura, any feature relying on GraphQL subscriptions beyond `gameStates`, `hasura_game_events`, and `timer_sync` will be blocked.

- [x] T001 Track all remaining DB tables in Hasura metadata — `games`, `gameEvents`, `athletes`, `teams`, `communities`, `seasons`, `tournaments`, `tournamentTeams`, `tournamentPools`, `tournamentStandings` in `hasura/metadata/`
- [x] T002 [P] Set up Hasura relationships: `games → gameEvents`, `games → gameStates`, `games → timerSync`, `teams → athletes` via `teamMemberships` in `hasura/metadata/`
- [x] T003 [P] Create public games listing view in Hasura metadata for unauthenticated access to `public_general` games
- [x] T004 [P] Configure `gamePresence` table subscriptions for active user/scorer presence tracking in `hasura/metadata/`
- [x] T005 Export updated Hasura metadata to `hasura/metadata/` and verify `replace_metadata` returns `"is_consistent": true`

**Checkpoint**: ✅ All tables accessible via GraphQL — run `GET /api/health` and verify Hasura metadata consistency.

---

## Phase 3: User Story 1 — Live Game Scoring — Multi-Scorer UI Gaps (Priority: P1) 🎯 PARTIALLY COMPLETE

**Goal**: Complete the multi-scorer experience — presence indicators, activity attribution, and conflict notification UI (API-level work is done; UI is missing).

**Status**: Partially completed across branches `021-hasura-metadata-multiscorer-ui` and `078-configurable-player-stats`

**Independent Test**: Open the same game in two browser tabs as two different scorers. Verify both scorers see each other's presence badge, see the scorer name on each game log event, and see a conflict toast when they both act simultaneously.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Add scorer presence indicator badges to scorer UI — read from `gamePresence` Hasura subscription in `src/app/game/[id]/scorer/page.tsx`
- [x] T007 [P] [US1] Add scorer name attribution to game log event rows — display `scorerName` from `hasura_game_events` in `src/app/game/[id]/log/page.tsx` and scorer game log component ✅ Already implemented in existing code
- [ ] T008 [US1] Implement conflict notification toast UI — show when two scorers perform conflicting state updates; use version field from `gameStates` to detect stale writes in `src/app/game/[id]/scorer/page.tsx`
- [x] T009 [US1] Add "bulk paste roster" input to bench selection and team edit — parse "23 Jordan, 33 Pippen" format in `src/app/game/[id]/scorer/` bench setup and `src/app/teams/[id]/` team edit page ✅ COMPLETED in branch `021-hasura-metadata-multiscorer-ui`
- [x] T010 [P] [US1] Add color picker to team creation and edit form — replace text color input with visual color swatch picker in `src/app/teams/` team creation/edit pages ✅ Already implemented in existing code

**Checkpoint**: Two-scorer workflow is fully visible and conflict-safe. Roster paste and color picker functional.

---

## Phase 4: User Story 2 — Spectator Real-Time View — No Outstanding Work

> Core spectator view (live scoreboard, QR code, public portal) is complete.
> Remaining item: **scorer presence is also shown on spectator view** — covered by T006 above if desired.

---

## Phase 5: User Story 3 — Team & Player Management Enhancements (Priority: P2)

**Goal**: Complete the player statistics dashboard, season management enhancements, and search UX improvements.

**Independent Test**: Navigate to a player profile with games across two seasons. Verify career highs display, "By Season" stats show correct segmentation, and a reusable season selector component is present on the profile page.

### Implementation for User Story 3 — Player Stats (Phase 15 Remainder)

- [ ] T011 [P] [US3] Add career highs calculation to `GET /api/players/[id]/stats` — best single-game points, rebounds, assists, etc. in `src/app/api/players/[id]/stats/route.ts`
- [ ] T012 [P] [US3] Add total minutes played aggregation to player stats API — derive from substitution events + clock in `src/app/api/players/[id]/stats/route.ts`
- [ ] T013 [P] [US3] Add season rankings endpoint — "Top 10 scorer in Season X" query in `src/app/api/seasons/[id]/standings/route.ts`
- [ ] T014 [US3] Display career highs section on player profile page at `src/app/players/[id]/page.tsx`
- [ ] T015 [US3] Display season rankings/achievements on player profile statistics tab in `src/app/players/[id]/page.tsx`
- [ ] T016 [P] [US3] Add stat trend charts (line/bar) to player profile using existing charting approach in `src/app/players/[id]/page.tsx`
- [ ] T017 [P] [US3] Add `seasonId` to athletes stats aggregation views — update `GET /api/players/[id]/stats` seasonId filter in `src/app/api/players/[id]/stats/route.ts`

### Implementation for User Story 3 — Season Management (Phase 15 Remainder)

- [ ] T018 [P] [US3] Add "Archive Season" action to season management — set status to "Archived", hide from active lists, preserve all data in `src/app/api/seasons/[id]/route.ts` and season UI in `src/app/communities/[id]/`
- [ ] T019 [P] [US3] Add "Duplicate Season" action — copy season structure (teams, not games) to new season in `src/app/api/seasons/` and season UI
- [ ] T020 [US3] Add season-specific team roster support — `teamSeasons` already exists; surface per-season roster view on team edit page in `src/app/teams/[id]/`

### Implementation for User Story 3 — Search & Filter UX (Phase 15 Remainder)

- [ ] T021 [P] [US3] Build reusable `AutocompleteSearch` component with debounced input and suggestion dropdown in `src/components/autocomplete-search.tsx`
- [ ] T022 [P] [US3] Build reusable `FilterChips` component — shows active filters as dismissible chips with count badge in `src/components/filter-chips.tsx`
- [ ] T023 [US3] Add team search with community/season filters to game creation flow in `src/app/games/` new game page (uses `GET /api/teams?communityId=&seasonId=`)
- [ ] T024 [US3] Add team selection with filters to tournament setup flow in `src/app/tournaments/[id]/` teams tab
- [ ] T025 [US3] Add "Active Teams Only" toggle and "Current Season" quick filter to teams list page in `src/app/teams/page.tsx`
- [ ] T026 [P] [US3] Add achievement/award display section to player profile page in `src/app/players/[id]/page.tsx`
- [ ] T027 [P] [US3] Add filter dropdowns (community, season) to team search in `src/app/teams/page.tsx`
- [ ] T028 [US3] Integrate `AutocompleteSearch` into player and team search inputs across app (team edit, game creation, tournament setup)

### Implementation for User Story 3 — Player Claim & Privacy (Phase 15 Remainder)

- [ ] T029 [P] [US3] Add merge-on-claim logic — when player accepts claim and a duplicate is detected, prompt community admin to approve merge during claim approval in `src/app/api/players/[id]/claim/route.ts` and `src/app/api/admin/claim-requests/[id]/route.ts`
- [ ] T030 [P] [US3] Add privacy settings to player profile — public vs. private stats toggle stored on `athletes` table; respect in stats API in `src/app/api/players/[id]/route.ts` and stats endpoint

**Checkpoint**: Player profile shows career highs and charts. Season archive/duplicate works. Search has autocomplete and filter chips.

---

## Phase 6: User Story 4 — Community Management — Outstanding Items (Priority: P2)

**Goal**: Complete community invite system, activity logging integration, and permission middleware gaps.

**Independent Test**: Invite a user via email, verify the invite token works, the invited user can accept and score a game, and all actions appear in community activity log.

### Implementation for User Story 4

- [ ] T031 [P] [US4] Complete invite system API — generate token, send email via Resend, accept invite endpoint fully wired in `src/app/api/communities/[id]/invites/` routes
- [ ] T032 [P] [US4] Complete member management — Promote/Demote/Remove member endpoints and UI in `src/app/api/communities/[id]/members/` and community dashboard `src/app/communities/[id]/`
- [ ] T033 [US4] Integrate `logActivity()` into Game Create, Score Update, and other key API routes — call `src/lib/activity-logger.ts` from `src/app/api/games/` and `src/app/api/games/[id]/events/` routes
- [ ] T034 [US4] Update `auth()` middleware to respect Community Roles — enforce Scorer/Viewer role permissions in `src/lib/auth-permissions.ts`
- [ ] T035 [US4] Implement `canManageGame(userId, gameId)` utility — factor out game permission logic into `src/lib/auth-permissions.ts`
- [ ] T036 [P] [US4] Surface pending player claim requests in community dashboard — list view + approve/reject actions in `src/app/communities/[id]/` dashboard

**Checkpoint**: Community invite flow end-to-end working. All game actions logged to activity log. Community admin can manage members and claim requests from dashboard.

---

## Phase 7: User Story 6 — Season Statistics (Phase 6 Remainder) (Priority: P3)

**Goal**: Complete season-over-season statistics aggregation.

**Independent Test**: View a player profile that has games in Season A and Season B. Verify the "By Season" tab shows correct per-season stats, and a season comparison view shows improvement metrics.

### Implementation for User Story 6

- [ ] T037 [P] [US6] Add comprehensive season stats aggregation endpoint — PPG, FPG, W/L per team per season in `src/app/api/seasons/[id]/standings/route.ts`
- [ ] T038 [P] [US6] Add season-over-season comparison endpoint — player improvement metrics across seasons in `src/app/api/players/[id]/stats/route.ts` (add `compareSeasons` query param)
- [ ] T039 [US6] Add season comparison UI to player profile statistics tab in `src/app/players/[id]/page.tsx`

**Checkpoint**: Player stats show full season-by-season breakdown with comparison metrics.

---

## Phase 8: User Story 7 — Tournament Management (Priority: P4) 🚧 In Development

**Goal**: Implement pool management, standings calculation, bracket generation, awards system, and complete the "Coming Soon" dashboard tabs.

**Independent Test**: Create a tournament with 4 teams, assign them to 2 pools of 2, auto-generate round-robin games, enter scores, and verify standings update correctly. Then advance to bracket and verify correct seedings.

### 8A — Tournament APIs (Phase 14.9)

- [ ] T040 [P] [US7] Implement `POST /api/tournaments/[id]/pools` — create/configure pools with team count and advancement rules in `src/app/api/tournaments/[id]/pools/route.ts`
- [ ] T041 [P] [US7] Implement `GET /api/tournaments/[id]/standings` — calculate standings (W/L, points diff, head-to-head tiebreaker) from game results in `src/app/api/tournaments/[id]/standings/route.ts`
- [ ] T042 [P] [US7] Implement `GET /api/tournaments/[id]/bracket` — return bracket data (seedings, pairings, results) in `src/app/api/tournaments/[id]/bracket/route.ts`
- [ ] T043 [P] [US7] Implement `POST /api/tournaments/[id]/generate-schedule` — auto-generate round-robin games within pools in `src/app/api/tournaments/[id]/generate-schedule/route.ts`
- [ ] T044 [P] [US7] Implement `POST /api/tournaments/[id]/advance` — seed knockout stage from pool standings, generate bracket pairings in `src/app/api/tournaments/[id]/advance/route.ts`
- [ ] T045 [P] [US7] Implement `GET /api/tournaments/[id]/awards` and `POST /api/tournaments/[id]/awards` — fetch/assign awards in `src/app/api/tournaments/[id]/awards/route.ts`

### 8B — Tournament Logic (Phase 14.2–14.5)

- [ ] T046 [US7] Implement pool standings calculation service — W/L, points differential, head-to-head tiebreaker in `src/lib/tournament-standings.ts` (depends on T040, T041)
- [ ] T047 [US7] Implement round-robin schedule generation algorithm for pools in `src/lib/tournament-schedule.ts` (depends on T040)
- [ ] T048 [US7] Implement bracket generation algorithm — seed from pool standings, handle byes in `src/lib/tournament-bracket.ts` (depends on T046)
- [ ] T049 [US7] Implement automatic standings recalculation on score update — trigger when `PATCH /api/tournaments/[id]/games/[gameId]/score` is called in `src/app/api/tournaments/[id]/games/[gameId]/score/route.ts`

### 8C — Tournament Dashboard UI (Phase 14.8)

- [ ] T050 [US7] Replace "Coming Soon" stub with Standings tab — pool tables + stats leaders using `GET /api/tournaments/[id]/standings` in `src/app/tournaments/[id]/page.tsx`
- [ ] T051 [US7] Replace "Coming Soon" stub with Bracket tab — interactive bracket tree using `GET /api/tournaments/[id]/bracket` in `src/app/tournaments/[id]/page.tsx`
- [ ] T052 [US7] Replace "Coming Soon" stub with Awards tab — winners and nominations using `GET /api/tournaments/[id]/awards` in `src/app/tournaments/[id]/page.tsx`
- [ ] T053 [P] [US7] Build pool view component — grid of pool games + current standings + advancement indicators in `src/components/tournament/pool-view.tsx`
- [ ] T054 [P] [US7] Build bracket visualization component — interactive bracket tree with live update support in `src/components/tournament/bracket-view.tsx`
- [ ] T055 [P] [US7] Build awards display component — award categories, winners, badges in `src/components/tournament/awards-view.tsx`
- [ ] T056 [P] [US7] Build tournament setup wizard — 5-step flow (basic info, pool setup, team assignment, schedule gen, review) in `src/app/tournaments/new/` or existing create flow

### 8D — Tournament Awards System (Phase 14.7)

- [ ] T057 [US7] Implement automatic award calculation — aggregate stats per player across tournament games, apply minimum games threshold and tiebreaking in `src/lib/tournament-awards.ts` (depends on T046)
- [ ] T058 [US7] Add manual award assignment UI — override automatic winners, add custom awards in `src/app/tournaments/[id]/` awards tab (depends on T052, T055)

### 8E — Tournament Status & Integration (Phase 14.3, 14.10)

- [ ] T059 [P] [US7] Implement tournament status transitions — Scheduled → Active → Completed with pause/resume/cancel in `src/app/api/tournaments/[id]/route.ts`
- [ ] T060 [P] [US7] Add tournament game badge/icon to games list in `src/app/games/page.tsx` and game cards
- [ ] T061 [P] [US7] Add tournament filter to games view in `src/app/games/page.tsx`
- [ ] T062 [P] [US7] Add tournament aggregate stats to player profile — stats across all tournament games in `src/app/api/players/[id]/stats/route.ts` and player profile page
- [ ] T063 [P] [US7] Add tournament history to team profile page in `src/app/teams/[id]/page.tsx`

### 8F — Tournament Public Page (Phase 14.8)

- [ ] T064 [US7] Create public tournament page `/tournaments/[id]/public` — read-only bracket, schedule, and standings (no auth required) in `src/app/tournaments/[id]/public/page.tsx`

**Checkpoint**: Full tournament lifecycle works — pool stage → bracket advancement → awards. All three dashboard tabs functional.

---

## Phase 9: Infrastructure — Backup & Monitoring Completion (Priority: P3)

**Goal**: Complete S3 backup configuration and add failure alerting.

**Independent Test**: Trigger a manual backup, verify it uploads to S3, then trigger a restore to a staging DB and verify data integrity.

- [ ] T065 [P] Create dedicated S3 bucket `bball-db-backups` with versioning enabled — update `scripts/backup-db.sh` and document in `docs/BACKUP_RESTORE.md`
- [ ] T066 [P] Configure S3 lifecycle policy — keep daily 7 days, weekly 4 weeks, monthly 12 months — update bucket policy and document
- [ ] T067 Add backup failure alerting — email/Slack notification on backup failure in `scripts/backup-db.sh` and environment variables
- [ ] T068 [P] Add monthly restore test procedure to `docs/BACKUP_RESTORE.md` — documented runbook with staging environment steps

**Checkpoint**: Backup pipeline has alerting and S3 retention policy configured.

---

## Phase 10: Hasura — Event Triggers & Testing (Phase 18 Remainder)

**Goal**: Complete Hasura event triggers and replace legacy test mocks.

- [ ] T069 [P] Create Hasura event trigger on `game_events` insert — webhook to `/api/hasura/game-event` broadcast handler in `hasura/metadata/` and `src/app/api/hasura/`
- [ ] T070 [P] Create Hasura event trigger on `game_states` update — webhook to `/api/hasura/game-state` broadcast handler in `hasura/metadata/` and `src/app/api/hasura/`
- [ ] T071 [P] Update test utilities for GraphQL mocking — replace legacy Convex mock patterns in `src/lib/test/` with Hasura subscription mocks
- [ ] T072 [P] Document GraphQL schema — available queries, mutations, subscriptions in `docs/GRAPHQL_SCHEMA.md`
- [ ] T073 [P] Update environment variables documentation in `docs/` or `.env.example` — include all Hasura vars

**Checkpoint**: Event triggers fire on DB changes. GraphQL schema documented. Test mocks updated.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T074 [P] Add architecture diagram showing Hasura integration flow to `docs/ARCHITECTURE.md`
- [ ] T075 [P] Add "Invite Scorer" UI flow — email input + shareable link with QR code in scorer UI `src/app/game/[id]/scorer/page.tsx` (API already exists)
- [ ] T076 [P] Game export as standalone HTML — box score + play-by-play export from game log page in `src/app/game/[id]/log/page.tsx` or box-score page

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational — Hasura metadata)**: No dependencies — start immediately. Unblocks T069/T070 event triggers.
- **Phase 3 (US1 — Multi-scorer UI)**: Depends on Phase 2 (T004 — `gamePresence` subscription). T006/T007/T008 can start after T004.
- **Phase 5 (US3 — Player & Team)**: Independent of Phase 2. Can start immediately in parallel with Phase 2.
- **Phase 6 (US4 — Community)**: Independent. Can start immediately.
- **Phase 7 (US6 — Season Stats)**: Independent. Can start after base player stats API confirmed working.
- **Phase 8 (US7 — Tournament)**: 8A (APIs) → 8B (logic) → 8C (UI). T046–T048 logic depends on T040–T042 APIs. T050–T052 UI depends on T046–T048 logic.
- **Phase 9 (Backup)**: Fully independent — can run in parallel with any phase.
- **Phase 10 (Hasura triggers)**: T069/T070 depend on Phase 2 Hasura metadata completion (T001).

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 for `gamePresence`. All other tasks (T008–T010) are independent.
- **US3 (P2)**: Fully independent — player API enhancements, season management, search UI.
- **US4 (P2)**: Mostly independent — community invite/permission work in existing API routes.
- **US6 (P3)**: Depends on existing player stats API. T037–T039 are sequential.
- **US7 (P4)**: Internal dependency chain: APIs → logic → UI → awards.

### Parallel Opportunities

All [P]-marked tasks within a phase can be executed concurrently:

```
# Phase 2 — All 5 tasks parallelizable:
T001 Track remaining Hasura tables
T002 Set up Hasura relationships
T003 Create public games view
T004 Configure gamePresence subscriptions
T005 Export and verify metadata

# Phase 5 — Player stats enhancements (all [P]):
T011 Career highs API
T012 Minutes played API
T013 Season rankings API
T016 Stat trend charts
T017 SeasonId aggregation

# Phase 8A — All 6 tournament APIs parallelizable:
T040 Pools API
T041 Standings API
T042 Bracket API
T043 Generate schedule API
T044 Advance API
T045 Awards API

# Phase 8C — UI components parallelizable after APIs done:
T053 Pool view component
T054 Bracket visualization component
T055 Awards display component
```

---

## Implementation Strategy

### Recommended Priority Order (Single Developer)

1. **Phase 2** (T001–T005): Hasura metadata — unblocks real-time features everywhere
2. **Phase 3** (T006–T010): US1 multi-scorer UI — completes core P1 user story
3. **Phase 6** (T031–T036): US4 community — completes invite/permission gaps
4. **Phase 5** (T011–T030): US3 player stats & search — high user-facing value
5. **Phase 8** (T040–T064): US7 tournament — largest scope, P4 priority
6. **Phases 9–11**: Infrastructure and polish

### MVP Increment (Quickest Path to Fully Functional)

1. T001–T005 (Hasura) → T006–T008 (scorer presence + conflict) → **Live scoring fully complete**
2. T031–T035 (community invite + permissions) → **Community management complete**
3. T040–T049 (tournament APIs + logic) + T050–T052 (UI tabs) → **Tournament usable end-to-end**

### Parallel Team Strategy (2+ Developers)

- **Developer A**: Phase 2 (Hasura) → Phase 3 (US1 scorer UI) → Phase 10 (triggers)
- **Developer B**: Phase 5 (US3 player/team) → Phase 6 (US4 community) → Phase 7 (US6 stats)
- **Developer C** (if available): Phase 8 (US7 tournament — largest scope)

---

## Task Summary

| Phase | Focus | Tasks | Priority |
|-------|-------|-------|----------|
| Phase 2 | Hasura metadata completeness | T001–T005 | Foundational |
| Phase 3 | Multi-scorer UI gaps (US1) | T006–T010 | P1 |
| Phase 5 | Player/Team/Search enhancements (US3) | T011–T030 | P2 |
| Phase 6 | Community management gaps (US4) | T031–T036 | P2 |
| Phase 7 | Season statistics (US6) | T037–T039 | P3 |
| Phase 8 | Tournament management (US7) | T040–T064 | P4 |
| Phase 9 | Backup & monitoring | T065–T068 | P3 |
| Phase 10 | Hasura event triggers + test utilities | T069–T073 | P3 |
| Phase 11 | Polish & cross-cutting | T074–T076 | Low |

**Total tasks**: 76
**Parallelizable tasks [P]**: 44
**Sequential tasks**: 32

---

## Notes

- [P] tasks = different files, no shared state dependencies
- [Story] label maps each task to a user story for traceability
- Phase 12 (Mobile) is **SUSPENDED** — no tasks included; resume only after web stability milestone
- `outstanding_tasks.md` items from Phase 5.3 (conflict resolution) are included here as T008
- `outstanding_tasks.md` Phase 7 items partially completed (claim approval pages done in Phase 15.9); remaining gaps captured in Phase 6 above
- Commit after each task or logical group; avoid cross-story commits
