# Implementation Plan: HoopHoop Basketball Scoring Platform

**Branch**: `main` | **Date**: 2026-02-28 | **Spec**: `.specify/memory/spec.md`
**Source**: Derived from `spec/implementation_plan.md` and `spec/outstanding_tasks.md`

---

## Summary

HoopHoop is a real-time basketball scoring and tournament management platform. The web application
(Next.js 15 + Hasura + PostgreSQL) is largely feature-complete through Phase 19. The outstanding
work centres on Tournament Management (Phase 14 — pool/bracket/awards logic), Hasura metadata
completeness (Phase 18), and minor platform gaps (season stats, search enhancements).

---

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js 18+
**Web Framework**: Next.js 15 (App Router) — Server Components + Client Components
**Mobile Framework**: React Native + Expo (managed workflow) — SUSPENDED
**Primary Dependencies**: Drizzle ORM, Hasura (GraphQL WebSocket subscriptions), Clerk (auth), Zustand, Framer Motion, @dnd-kit/core, graphql-ws, graphql-request
**Storage**: PostgreSQL 16 (via Docker; Drizzle migrations in `drizzle/`)
**Testing**: Vitest + @testing-library/react (web); Jest + @testing-library/react-native (mobile, suspended)
**Target Platform**: Docker-based VPS / container runtime; Next.js on Node.js; Hasura as sidecar
**Performance Goals**: Scorer→Spectator latency < 500ms p95; ≥ 5 concurrent scorers per game; timer sync accuracy ≤ 1s across clients
**Constraints**: No Vercel deployment (requires Hasura sidecar); no Socket.io; no Convex; TypeScript strict mode enforced
**Scale/Scope**: ~100 concurrent live games, ~10,000 athletes in registry, ~1,000 concurrent spectators

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ | Hasura subscriptions active; timerSync table drives clock sync |
| II. Mobile-First Design | ✅ | 6-player overlay constraint documented and implemented |
| III. Data Integrity | ✅ | Soft-delete everywhere; merge is transactional; event append-only |
| IV. Permission Hierarchy | ✅ | 5-step hierarchy enforced in all API routes |
| V. Test Coverage | ⚠️ | Integration test coverage for new tournament APIs pending |
| VI. TypeScript Strict | ✅ | No `as any` / `@ts-ignore` in application code |
| VII. Incremental Complexity | ✅ | Mobile suspended; tournament logic deferred to Phase 14 completion |

---

## Project Structure

### Documentation (speckit)

```text
.specify/
├── memory/
│   ├── constitution.md     # Project governing principles (v1.0.0)
│   ├── spec.md             # Platform-wide feature specification
│   └── plan.md             # This file — implementation plan
└── templates/              # speckit templates (unchanged)
```

### Source Code Layout

```text
/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # REST API routes
│   │   │   ├── games/          # Game CRUD, events, roster, scoring
│   │   │   ├── teams/          # Team CRUD, memberships
│   │   │   ├── players/        # Athlete search, profile, stats, claims
│   │   │   ├── communities/    # Community CRUD, members, invites
│   │   │   ├── seasons/        # Season management
│   │   │   ├── tournaments/    # Tournament CRUD (partial)
│   │   │   ├── admin/          # World Admin routes
│   │   │   └── public/         # Unauthenticated game/community feeds
│   │   ├── game/[id]/          # Scorer, spectator, box-score, log views
│   │   ├── community/[slug]/   # Community portal (public)
│   │   ├── live/               # World public dashboard
│   │   ├── admin/              # World Admin dashboard
│   │   └── ...                 # Other app pages
│   ├── components/             # Shared React components
│   │   └── HasuraProvider.tsx  # Injects Clerk JWT into Hasura WS connection
│   ├── db/                     # Drizzle schema definitions and config
│   ├── hooks/                  # Custom React hooks
│   │   └── use-hasura-game.ts  # Unified Hasura subscription + mutation hook
│   ├── lib/                    # Pure utility functions (scoring, permissions)
│   └── server/                 # Server-side utilities
├── drizzle/                    # PostgreSQL migration files
├── hasura/                     # Hasura metadata (exported table configs)
├── spec/                       # Legacy spec documents (source of truth migrated here)
├── scripts/                    # DB backup, migration helpers
├── mobile/                     # React Native app (SUSPENDED — directory removed)
└── packages/shared/            # Shared TypeScript types (future mobile reuse)
```

---

## Phase Status Overview

### ✅ Complete Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation & Data Layer | Complete |
| 2 | Game Setup & Real-time | Complete |
| 3 | Frontend Core (Scorer Views) | Complete |
| 4 | Share & Public Views | Complete |
| 5 | Multi-Scorer & Centralized Timer | Complete |
| 7 | Community & Advanced User System | Complete |
| 8 | Public Game Portals | Complete |
| 9 | Bench Selection & Scoring UX | Complete |
| 10 | Player Search, DOB & Roster UX | Complete |
| 11 | Player Merging & Admin Tools | Complete |
| 13 | Game Soft Delete | Complete |
| 15 | Player Profiles, Seasons & Search | Complete |
| 16 | High-Scale Socket Infrastructure | Complete (superseded by Hasura) |
| 17 | Database Backup & S3 Storage | Mostly complete |
| 18 | Hasura Real-Time Migration | Core complete; metadata partial |
| 19 | Hasura Production Stability Fixes | Complete |

### 🔄 In Progress / Outstanding

---

## Phase 6 — Season Statistics (Partial)

**Status**: Phase 6.1 (Game Summary) complete. Phase 6.2 outstanding.

### 6.2 Season Statistics
- [ ] Comprehensive season statistics aggregation endpoint (PPG, FPG, W/L per team per season)
- [ ] Season-over-season comparison features (e.g., player improvement)
- [ ] `seasonId` added to athletes stats aggregation views

---

## Phase 14 — Tournament Management (Partial)

**Status**: Infrastructure + basic CRUD done. Pool/bracket/awards logic not implemented.

### 14.4 Pool Stage Management
- [ ] Pool configuration: number of pools, teams per pool, games per team, advancement rules
- [ ] Automatic pool game generation (round-robin schedule within each pool)
- [ ] Pool standings calculation: W/L, points differential, head-to-head tiebreaker
- [ ] Visual pool view: grid of games, current standings, advancement status indicators

### 14.5 Knockout Stage Management
- [ ] Automatic bracket generation from pool results (seed by standings, create pairings)
- [ ] Manual bracket editing: drag-and-drop placement, custom seedings, bye handling
- [ ] Bracket visualization: interactive bracket tree, live updates as games complete
- [ ] Multiple bracket support: championship, consolation, losers bracket (double elim)

### 14.6 Manual Score Entry — Advanced
- [ ] Game result confirmation dialog
- [ ] Override existing scores with audit trail logging
- [ ] Batch score entry (CSV import, quick entry mode)
- [ ] Automatic standings recalculation on score update

### 14.7 Tournament Awards System
- [ ] Award categories: MVP, Best Scorer, Best Defender, Best Rebounder, Best Assists, Best 3PT, Best FT%, Most Improved, Coach's Award, Sportsmanship, All-Tournament Team
- [ ] Automatic award calculation (stats aggregation, minimum games threshold, tiebreaking)
- [ ] Manual award assignment with override capability
- [ ] Award display: awards page, player profile badges, team tournament history

### 14.8 Tournament Dashboard — Missing Tabs
- [ ] Standings tab: Pool tables, stats leaders (currently shows "Coming Soon")
- [ ] Bracket tab: Interactive bracket view (currently shows "Coming Soon")
- [ ] Awards tab: Winners and nominations (currently shows "Coming Soon")
- [ ] Tournament public page (read-only bracket/schedule/standings for public visibility)

### 14.9 Tournament APIs — Missing Endpoints
- [ ] `POST /api/tournaments/[id]/pools` — Create/manage pools
- [ ] `POST /api/tournaments/[id]/generate-schedule` — Auto-generate round-robin games
- [ ] `POST /api/tournaments/[id]/advance` — Advance to knockout stage
- [ ] `GET /api/tournaments/[id]/standings` — Get current standings (calculated)
- [ ] `GET /api/tournaments/[id]/bracket` — Get bracket data
- [ ] `GET /api/tournaments/[id]/awards` — Get awards data
- [ ] `POST /api/tournaments/[id]/awards` — Assign awards

### 14.10 Tournament Integration
- [ ] Tournament game badge/icon in games list
- [ ] Tournament filter in games view
- [ ] Tournament stats in player profiles (aggregate across tournament games)
- [ ] Tournament history in team profiles

---

## Phase 15 — Player Profiles, Seasons & Search (Partial)

**Status**: Core complete. Enhancement backlog remaining.

### 15.1 Player Invitation — Remaining
- [ ] Merge duplicate profiles during claim process (when duplicate detected on claim)
- [ ] Privacy settings for player profiles (public vs. private stats)

### 15.2 Player Statistics Dashboard — Remaining
- [ ] Career highs (best game stats — highest single-game points, etc.)
- [ ] Total minutes played (derived from substitution events + clock)
- [ ] Teammates played with most (co-occurrence in game rosters)
- [ ] Jersey number history per team (timeline view)
- [ ] Season rankings (e.g., "Top 10 scorer in Season 2025")
- [ ] Season awards/achievements display
- [ ] Progress tracking (stat trends across seasons)
- [ ] Charts/graphs for stat trends (line/bar charts)
- [ ] Compare stats to community/league averages

### 15.3 Season Management — Remaining
- [ ] Archive old seasons (hide from active lists, preserve data)
- [ ] Duplicate season (copy structure for new year)
- [ ] Season-specific team rosters (players may differ by season)

### 15.4 Enhanced Team Search — Remaining
- [ ] Filter by team status (active/inactive)
- [ ] Team search with community/season filters in game creation flow
- [ ] Team selection with filters in tournament setup
- [ ] Autocomplete suggestions in team/player search
- [ ] Saved filters and recent searches
- [ ] Clear all filters button + filter count indicator

### 15.8 UI Components — Remaining
- [ ] Achievement/award display on player profile page
- [ ] Reusable season selector component
- [ ] Autocomplete search bar component
- [ ] Filter chips/badges for active filters

---

## Phase 17 — Database Backup & S3 Storage (Partial)

### 17.2 S3 Configuration — Remaining
- [ ] Create dedicated S3 bucket for database backups
- [ ] Enable S3 versioning for backup recovery
- [ ] Configure S3 lifecycle policy (tiered cost optimization)

### 17.4 Monitoring — Remaining
- [ ] Alert on backup failures (email/Slack notification)
- [ ] Backup size monitoring and cost tracking dashboard

### 17.5 Restoration Testing — Remaining
- [ ] Monthly restore test to staging environment (documented runbook exists)
- [ ] Point-in-time recovery capability (if using RDS)

---

## Phase 18 — Hasura Metadata Completeness (Partial)

### 18.2 Database Schema to Hasura
- [ ] Track all remaining tables in Hasura (games, gameEvents, athletes, teams, communities, etc.)
- [ ] Set up relationships: games → gameEvents, games → gameStates, teams → athletes via memberships
- [ ] Create views for public games listing
- [ ] Set up custom functions for complex queries (e.g., score recalculation)

### 18.4 Event Triggers
- [ ] Event trigger on `gameEvents` insert → broadcast to subscribers
- [ ] Event trigger on `gameStates` update → broadcast to subscribers
- [ ] Presence tracking (join/leave game events via `gamePresence` table)

### 18.9 Hasura Metadata — Remaining
- [ ] Export metadata for all remaining tables (currently only 3 tables exported)
- [ ] Create migration files for any schema changes via Hasura CLI
- [ ] Set up seed data for testing

### 18.10 Testing & Validation
- [ ] Update test utilities for GraphQL mocking (replace Convex mocks)
- [ ] Test real-time subscriptions with multiple clients (integration)
- [ ] Validate timer synchronization accuracy under load
- [ ] Test authentication/authorization flow end-to-end
- [ ] Performance testing vs. Socket.io benchmarks

### 18.11 Documentation
- [ ] Document GraphQL schema and available queries/subscriptions
- [ ] Update environment variables documentation
- [ ] Add architecture diagram showing Hasura integration flow

---

## Phase 12 — Mobile Application (SUSPENDED)

> Mobile app development is suspended. `/mobile` directory removed. Resume only after web platform
> reaches stability milestone. All mobile tasks preserved below for future reference.

- [ ] 12.1 Expo project scaffolding + EAS configuration
- [ ] 12.2 `@clerk/clerk-expo` authentication (Google OAuth, token storage)
- [ ] 12.3 Navigation: bottom tabs (Games, Profile), stack navigator
- [ ] 12.4 Game List screen (pull-to-refresh, game cards)
- [ ] 12.5 Game Creation screen (team selection, config, visibility)
- [ ] 12.6 Bench Selection screen
- [ ] 12.7 Live Scoring screen — Simple Mode (6-player overlay, clock, fouls, game log)
- [ ] 12.8 App Store deployment (Android Play Store, iOS App Store, TestFlight, CI/CD)

---

## Phase 20 — Platform Gaps & Technical Debt (Backlog)

*Items not in the original phase plan but identified as gaps.*

- [ ] **Multi-scorer conflict notification UI**: When two scorers perform conflicting actions simultaneously, notify both in-UI (Phase 5.3 — partially documented, UI not implemented).
- [ ] **Optimistic concurrency control**: Version/timestamp fields for stale update detection (Phase 5.3).
- [ ] **Scorer presence indicators**: Show which scorers are active on the game in real-time (Phase 5.2 — API done, UI pending).
- [ ] **Activity attribution in game log**: Display which scorer performed each action (Phase 5.2 — partially done).
- [ ] **Bulk paste roster**: Paste "23 Jordan, 33 Pippen" format to build roster quickly (Phase 2.5.4).
- [ ] **Color picker for teams**: Visual color picker on team creation/edit (Phase 2.5.4).
- [ ] **Shot charting enhancements**: Heat maps, made/missed overlays on court image (Phase 3).
- [ ] **Game export as HTML**: Standalone HTML export of box score + play-by-play (Phase 3.5 — partially done).

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Hasura as separate service | Declarative real-time subscriptions without custom WebSocket server | Custom Node.js Socket.io server required complex room management, rate limiting, and horizontal scaling logic |
| Dual permission system (Clerk + DB roles) | Clerk handles auth UI; community/game permissions are domain-specific | Clerk metadata alone is insufficient for community-scoped resource ownership checks |
| Tournament as separate data model | Tournaments have multi-phase lifecycle (pool → bracket → awards) incompatible with single-game model | Encoding tournament structure into game metadata would require unbounded JSONB queries |

---

## Research & Architecture Decisions

### Hasura vs. Socket.io (Resolved — Phase 18)
**Decision**: Hasura GraphQL WebSocket subscriptions replace Socket.io.
**Rationale**: Declarative subscriptions, no custom room management, horizontal scaling via PostgreSQL,
schema-driven permissions, reconnection handled by the client library.
**Alternatives considered**: Socket.io (removed — required custom server), Convex (removed — vendor lock-in, cost).

### Timer Architecture (Resolved — Phase 5/18)
**Decision**: `timerSync` table in PostgreSQL, observed via Hasura subscription.
**Rationale**: Server is authoritative; clock survives disconnects; all clients compute time from
`startedAt + elapsed`, eliminating drift.

### Player Identity (Resolved — Phase 10/11)
**Decision**: Global `athletes` table with `communityId`, `isWorldAvailable`, `mergedIntoId`, `status`.
**Rationale**: Players participate in multiple teams over time; merge capability requires a canonical
identity with reassignable references.

### Score as Derived State (Resolved — Phase 3/9)
**Decision**: Append-only `game_events` table; `games.home_score`/`guest_score` are denormalized
caches updated by server-side reduction on every event mutation or deletion.
**Rationale**: Undo is free (delete last event + recalculate); audit trail is complete; no score
corruption from concurrent updates.
