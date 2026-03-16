# Implementation Plan: Shot Ratio Display in Game Log

**Branch**: `079-shot-ratio-display` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/079-shot-ratio-display/spec.md`

## Summary

Add shot ratio display (made/attempts) to game log events for score and miss events. The core implementation already exists in `src/components/scorer/game-log.tsx` with the `getShotRatio()` function. This plan covers adding test coverage for the existing implementation and verifying edge cases work correctly.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no escape hatches per constitution)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Framer Motion, Tailwind CSS
**Storage**: N/A (client-side calculation from existing events array)
**Testing**: Vitest + @testing-library/react
**Target Platform**: Web (mobile-first responsive design)
**Project Type**: Next.js web application
**Performance Goals**: Ratio calculation must complete in <1ms for 100+ events (SC-005)
**Constraints**: 320px minimum mobile width, touch targets ≥48×48px (Principle II)
**Scale/Scope**: Single component modification, ~50 lines of test code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ Pass | Ratio is calculated client-side from events array; events already sync via Hasura WebSocket |
| II. Mobile-First Design | ✅ Pass | Display is text-based, already fits mobile; no new touch targets |
| III. Data Integrity | ✅ Pass | Read-only calculation; no data mutations |
| IV. Permission Hierarchy | ✅ Pass | No permission changes; ratio is display-only |
| V. Test Coverage | ⚠️ Needs Tests | Core business logic (`getShotRatio`) needs unit tests |
| VI. TypeScript Strict | ✅ Pass | Existing code uses strict types; no escape hatches |
| VII. Incremental Complexity | ✅ Pass | Pure function calculation; no new services |

**GATE RESULT**: ✅ PASS - Only missing test coverage (Principle V)

## Project Structure

### Documentation (this feature)

```text
specs/079-shot-ratio-display/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── scorer/
│       └── game-log.tsx                     # EXISTING: Contains getShotRatio() and display
└── components/
    └── scorer/
        └── __tests__/
            └── game-log.test.ts              # NEW: Unit tests for getShotRatio()

tests/
└── e2e/
    └── shot-ratio.spec.ts                   # NEW: E2E test for shot ratio display
```

**Structure Decision**: Minimal change — add tests for existing implementation. No new components or services needed.

---

## Phase 0: Research

### Decision 1: Implementation Already Exists

- **Decision**: The `getShotRatio()` function already exists in `src/components/scorer/game-log.tsx` (lines 61-89) and is already integrated into the event display (lines 152-157).
- **Rationale**: Code review confirms the implementation matches the spec requirements:
  - Filters for `score` and `miss` events (FR-001)
  - Calculates player + shot value combinations (FR-002)
  - Uses chronological sorting for cumulative ratio (FR-003)
  - Counts made (score) and attempts (score + miss) correctly (FR-004, FR-005)
  - Display is styled with muted color `text-slate-500` (FR-006)
  - React reactivity handles add/edit/delete updates (FR-007)
  - Returns null when no player (FR-008)
  - Returns null for non-score/miss types (FR-009)
- **Alternatives considered**: N/A — implementation exists

### Decision 2: Missing Test Coverage

- **Decision**: Add Vitest unit tests for `getShotRatio()` and E2E tests for display verification.
- **Rationale**: Principle V requires test coverage for business logic. The `getShotRatio` function is pure calculation logic and needs tests for:
  - Basic ratio calculation
  - Edge cases (first attempt, miss-only, mixed shot types)
  - Multi-player independence
  - Event chronology correctness
- **Alternatives considered**: Snapshot tests — rejected because calculation logic is better tested with explicit assertions

### Decision 3: No API Changes Needed

- **Decision**: Ratio is computed client-side from the existing `events` array prop.
- **Rationale**: The spec assumption "ratio is calculated client-side from the events array; no additional API endpoints is required" is correct. The `GameLog` component already receives the full events array as a prop.
- **Alternatives considered**: Server-side ratio calculation — rejected as premature optimization; client-side is fast enough for 100+ events

---

## Phase 1: Design

### Data Model Changes

None. The feature uses existing `GameEvent` type:

```typescript
type GameEvent = {
    id: string;
    type: 'score' | 'rebound' | 'assist' | 'steal' | 'block' | 'turnover' | 'foul' | 'timeout' | 'sub' | 'miss' | 'period_start' | 'period_end' | 'clock_start' | 'clock_stop' | 'undo' | 'game_end';
    player?: string;
    team: 'home' | 'guest';
    value?: number;
    description?: string;
    timestamp: Date;
    clockAt?: number;
    period?: number;
    metadata?: Record<string, unknown>;
    createdBy?: string;
};
```

### Interface: `getShotRatio(event, allEvents)`

Existing function signature (no changes needed):

```typescript
function getShotRatio(
    event: GameEvent,
    allEvents: GameEvent[]
): string | null
```

**Returns**: `"(made/attempts)"` string or `null` when not applicable.

### Test Cases

| ID | Scenario | Input | Expected Output |
|----|----------|-------|------------------|
| T1 | First score attempt | Player's first 2PT score | "(1/1)" |
| T2 | First miss attempt | Player's first 2PT miss | "(0/1)" |
| T3 | Mixed make/miss | 2 made, 1 miss, then 1 more attempt | "(2/4)" |
| T4 | Different shot types | 1PT made, 2PT made, 2PT missed, 3PT made | Each shows correct type ratio |
| T5 | Multi-player | Player A: 2/3 on 2PT, Player B: 1/2 on 2PT | Each shows independent ratio |
| T6 | No player | Event with `player: undefined` | `null` |
| T7 | Non-score/miss type | Foul, rebound, assist events | `null` |
| T8 | Chronology | Events with same timestamp, different creation order | Sorted by creation order (timestamp + id) |
| T9 | Different teams | Player scores for home team, then guest team | Ratios are separate per team |

### Implementation Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-001 | ✅ Implemented | `getShotRatio` checks `type === 'score' \|\| type === 'miss'` |
| FR-002 | ✅ Implemented | Filters by `player === event.player && value === event.value` |
| FR-003 | ✅ Implemented | Sorts by `timestamp` chronological order |
| FR-004 | ✅ Implemented | `made = events.filter(e => e.type === 'score')` |
| FR-005 | ✅ Implemented | `attempts = events.filter(e => e.type === 'score' \|\| e.type === 'miss')` |
| FR-006 | ✅ Implemented | `<span className="text-slate-500 ml-1">{ratio}</span>` |
| FR-007 | ✅ Implemented | React prop reactivity; `events` is passed as prop |
| FR-008 | ✅ Implemented | Returns `null` when `!event.player` |
| FR-009 | ✅ Implemented | Returns `null` when `type !== 'score' && type !== 'miss'` |

### Missing Items

| Item | Status | Action |
|------|--------|--------|
| Unit tests for `getShotRatio` | ❌ Missing | Create `game-log.test.ts` |
| E2E test for display | ❌ Missing | Create `shot-ratio.spec.ts` |
| Edge case verification (team separation) | ⚠️ Unverified | Verify in tests; may need fix |

### Edge Case: Team Separation

The current implementation does **not** separate ratios by team. If a player switches teams mid-game, the ratio accumulates across both teams. This needs verification:

```typescript
// Current code (line 78-79):
const made = eventsUpToNow.filter(
    (e) => e.type === 'score' && e.player === event.player && e.value === event.value
).length;
```

This does NOT filter by `team`. Per the spec edge case:
> "Ratio is calculated per player per team; if team changes, ratios are separate for each team stint."

**Action**: Add team filter to the calculation OR update spec assumption to match implementation.

### Verification

1. `npx tsc --noEmit` — no new TypeScript errors
2. `npm test` — all existing tests pass + new tests pass
3. Manual smoke: View game log with score events, verify ratio displays

---

## Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh opencode` after completing Phase 1.
