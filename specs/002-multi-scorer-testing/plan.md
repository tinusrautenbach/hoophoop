# Implementation Plan: Multi-Scorer Concurrent Testing & Fixes

**Branch**: `002-multi-scorer-testing` | **Date**: 2026-03-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-multi-scorer-testing/spec.md`

## Summary

Build a comprehensive concurrent testing suite for multi-scorer game scoring, fix production bugs revealed by tests (primarily: PATCH event handler missing score recalculation), add full score recalculation at trigger points (period change, halftime, game finalization, timeout, scorer reconnection), add a force-recalculate button to the scorer UI, and verify role-based access control under concurrent conditions. Tests extend existing files (`use-hasura-game.concurrent.test.ts`, `concurrent-scorers.test.ts`) using established patterns (T093+ numbering, `buildCasMock`, `setupSubscriptions`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no escape hatches per constitution)  
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM, Hasura GraphQL (WebSocket subscriptions), Clerk (auth), Zustand, Vitest, @testing-library/react  
**Storage**: PostgreSQL 16 via Drizzle ORM — `games` (denormalized totals), `gameEvents` (source of truth), `gameRosters` (player stats), `gameStates` (Hasura sync cache)  
**Testing**: Vitest + @testing-library/react — mocked Hasura client, CAS mock helpers  
**Target Platform**: Web (Next.js) — scorer interface runs on mobile and desktop browsers  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: Scorer→Spectator update latency <500ms p95; ≥5 concurrent scorers without degradation; test suite <60s  
**Constraints**: No `as any`/`@ts-ignore`; all scoring events append-only; PostgreSQL is source of truth (Hasura sync is non-fatal)  
**Scale/Scope**: ~8 files modified, ~4 new files, ~30 new test cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ PASS | Full recalculation syncs to Hasura via `UPSERT_GAME_STATE_MUTATION` with version increment; all connected clients receive updates within 500ms |
| II. Mobile-First Design | ✅ PASS | Force-recalc button follows existing touch-target patterns (≥48×48px); no hover-only interactions |
| III. Data Integrity Over Convenience | ✅ PASS | Core focus of this feature — full recalculation from events is the safety net; PATCH fix ensures amendment correctness |
| IV. Permission Hierarchy | ✅ PASS | Tests verify viewer cannot mutate, co_scorer can score but not manage; existing `canManageGame()` used |
| V. Test Coverage for Business Logic | ✅ PASS | Score recalculation, timer sync, and permission checks are explicitly tested (non-negotiable targets per constitution) |
| VI. TypeScript Strict Mode | ✅ PASS | No escape hatches; type contracts validated in FR-010 |
| VII. Incremental Complexity | ✅ PASS | No new external services; uses existing Hasura/PostgreSQL/Clerk stack; recalculation is a service function, not a new layer |

**Gate Result**: ALL PASS — no violations, no complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-scorer-testing/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── services/
│   └── game.ts                          # MODIFY: Add recalculateGameTotals()
├── app/
│   ├── api/games/[id]/
│   │   ├── events/route.ts              # MODIFY: Fix PATCH handler recalculation
│   │   └── recalculate/route.ts         # NEW: Force-recalculate API endpoint
│   └── game/[id]/scorer/
│       └── page.tsx                     # MODIFY: Add force-recalc button, recalc triggers, toast
├── hooks/
│   ├── use-hasura-game.ts               # MODIFY: Add recalc on period/status change, reconnection
│   └── __tests__/
│       ├── use-hasura-game.concurrent.test.ts  # MODIFY: Extend with new T-series tests
│       └── regression.test.ts           # MODIFY: Add PATCH recalculation regression test
├── components/
│   └── scorer/
│       └── recalc-toast.tsx             # NEW: Recalculation result toast component
└── lib/
    └── hasura/
        └── __tests__/test-utils.ts      # MODIFY: Add recalculation test helpers

tests/
└── load/
    └── concurrent-scorers.test.ts       # MODIFY: Extend with recalc + role tests
```

**Structure Decision**: Next.js App Router (existing). No new top-level directories. New recalculate endpoint follows existing API route patterns. Toast component follows existing scorer component structure.
