# Implementation Plan: Configurable Player Statistics

**Branch**: `078-configurable-player-stats` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/078-configurable-player-stats/spec.md`

## Summary

Implement configurable player statistics tracking with per-game stat configuration, multi-scorer stat focus preferences, and real-time aggregation. The feature enables distributed scoring where different scorers can focus on different statistics (e.g., one scorer tracks points, another tracks rebounds) while all data aggregates correctly.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM, Hasura GraphQL, Zustand, Framer Motion  
**Storage**: PostgreSQL 16 via Drizzle ORM, Hasura GraphQL for real-time subscriptions  
**Testing**: Vitest + @testing-library/react  
**Target Platform**: Web (mobile-first responsive design)  
**Project Type**: Web application with real-time scoring interface  
**Performance Goals**: <500ms event propagation p95, support 5+ concurrent scorers  
**Constraints**: 320px minimum mobile width, touch targets ≥48×48px, TypeScript strict mode (no escape hatches)  
**Scale/Scope**: Per-game stat configuration with season/community defaults inheritance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ Pass | Uses Hasura subscriptions for stat sync; targets <500ms propagation |
| II. Mobile-First Design | ✅ Pass | Stat focus reduces UI clutter; quick-access buttons for 1-3 stats |
| III. Data Integrity | ✅ Pass | Events append-only with audit trail; soft-delete pattern |
| IV. Permission Hierarchy | ✅ Pass | Game owner configures stats; any scorer can edit (per spec) |
| V. Test Coverage | ✅ Pass | Service-layer stat aggregation functions need tests |
| VI. TypeScript Strict | ✅ Pass | No new escape hatches; strict types for stat types |
| VII. Incremental Complexity | ✅ Pass | Builds on existing event system; no new external services |

**GATE RESULT**: ✅ **PASS** - All constitution principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/078-configurable-player-stats/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── games/
│   │       └── [id]/
│   │           ├── stat-config/        # Game stat configuration endpoints
│   │           ├── scorer-focus/       # Per-scorer stat focus endpoints
│   │           └── events/
│   │               └── audit/          # Event audit trail endpoints
│   └── game/
│       └── [id]/
│           ├── scorer/
│           │   ├── stat-config-panel.tsx   # Stat configuration UI
│           │   ├── stat-focus-selector.tsx # Scorer focus UI
│           │   ├── more-stats-modal.tsx    # Secondary stats access
│           │   └── stat-buttons/           # Quick-access stat buttons
│           └── box-score/
│               └── stats-aggregation.tsx   # Real-time stats display
├── components/
│   └── scorer/
│       ├── stat-button.tsx             # Individual stat button component
│       ├── stat-button-grid.tsx        # Layout for stat buttons
│       └── stat-indicator.tsx          # Visual stat indicators
├── db/
│   └── schema.ts                       # Schema additions for stat config
├── hooks/
│   ├── use-stat-config.ts              # Game stat configuration hook
│   ├── use-scorer-focus.ts             # Scorer focus preferences hook
│   └── use-player-stats.ts             # Real-time stat aggregation hook
├── lib/
│   └── stats/
│       ├── stat-aggregator.ts          # Stat aggregation logic
│       ├── stat-calculator.ts          # Derived stat calculations
│       └── stat-types.ts               # TypeScript stat type definitions
├── services/
│   └── stats.ts                        # Stat service layer
└── types/
    └── stats.ts                        # Shared stat type definitions
```

**Structure Decision**: Single Next.js 15 web application following existing patterns. New features organized under `src/app/game/[id]/scorer/` for UI components, `src/lib/stats/` for business logic, and `src/services/stats.ts` for service layer.

## Complexity Tracking

> No constitution violations detected. Feature stays within existing tech stack.

| Component | Complexity | Justification |
|-----------|------------|---------------|
| Stat Configuration | Medium | Inherits from season/community with per-game override |
| Real-time Aggregation | Medium | Uses existing Hasura subscription pattern |
| Multi-scorer Focus | Low | Per-user preference storage, no coordination needed |
| Audit Trail | Low | Extends existing event system with version fields |
| Derived Stats | Low | Simple calculations (sum, derived from primary) |

---

## Phase 0: Research

See [research.md](./research.md)

## Phase 1: Design

### Phase 1.1: Data Model

See [data-model.md](./data-model.md)

### Phase 1.2: Contracts

See [contracts/](./contracts/)

### Phase 1.3: Quickstart

See [quickstart.md](./quickstart.md)

### Phase 1.4: Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh opencode` after completing Phase 1.

---

## Phase 2: Tasks

To be generated by `/speckit.tasks` command after Phase 1 completion.
