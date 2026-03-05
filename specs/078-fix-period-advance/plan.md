# Implementation Plan: Fix Period Advance — Conflict & Timer Reset

**Branch**: `078-fix-period-advance` | **Date**: 2026-03-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/078-fix-period-advance/spec.md`

## Summary

Clicking "Start Next Period" fires a false scoring-conflict notification and leaves the timer un-reset. The root cause: `nextPeriod()` dispatches `updatePeriod()` and `updateClock()` as blind (non-versioned) upserts first, which each increment the server-side `version` counter. When `updateFouls()` then runs through `versionedUpdate()` it compares its stale local version against the now-advanced server version and gets `affected_rows: 0` — triggering the conflict banner. The timer is never reset because `timer_sync` is only updated by `stopTimer()`, which is called *after* the fouls update fails.

The fix: introduce a dedicated `advancePeriod()` function in `use-hasura-game.ts` that uses the existing `versionedUpdate` path to atomically update `currentPeriod`, `clockSeconds`, `homeFouls`, and `guestFouls` in a single CAS mutation on `game_states`. After that CAS succeeds, `timer_sync` is updated sequentially (stop + reset clock). New Vitest tests cover the full period-advance flow.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no escape hatches)
**Primary Dependencies**: Next.js 16 (App Router), Hasura GraphQL WebSocket, Vitest + @testing-library/react
**Storage**: PostgreSQL 16 via Hasura — `game_states` (versioned CAS), `timer_sync` (blind upsert)
**Testing**: Vitest — new tests added to `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`
**Target Platform**: Node.js server (Next.js custom server)
**Project Type**: Web application
**Performance Goals**: Period advance must propagate to all clients < 500ms (Principle I)
**Constraints**: `as any`, `@ts-ignore`, `@ts-expect-error` FORBIDDEN (Principle VI). No new external dependencies (Principle VII).
**Scale/Scope**: Single-file hook change + scorer page refactor + tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ Pass | Single CAS mutation propagates to all clients via existing subscription |
| II. Mobile-First | ✅ Pass | No UI change — button and layout unchanged |
| III. Data Integrity | ✅ Pass | Atomic CAS prevents double-advance from two concurrent scorers |
| IV. Permission Hierarchy | ✅ Pass | No permission changes |
| V. Test Coverage | ✅ Pass | New tests required (FR-006); period advance is business logic per Principle V |
| VI. TypeScript Strict | ✅ Pass | No escape hatches; existing types cover all new parameters |
| VII. Incremental Complexity | ✅ Pass | Reuses existing `versionedUpdate`; no new dependencies |

All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/078-fix-period-advance/
├── plan.md              # This file
├── research.md          # Phase 0 output (inline below)
├── tasks.md             # Phase 2 output (/speckit.tasks command)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (affected files)

```text
src/
├── hooks/
│   └── use-hasura-game.ts          # ADD: advancePeriod() function
├── app/game/[id]/scorer/
│   └── page.tsx                    # CHANGE: nextPeriod() calls advancePeriod()
└── hooks/__tests__/
    └── use-hasura-game.concurrent.test.ts  # ADD: T108–T112 period-advance tests
```

**Structure Decision**: Single-project layout. No new files except test cases appended to the existing concurrent test file. No new npm packages.

## Phase 0: Research

**All unknowns resolved.**

### Decision 1: Reuse `versionedUpdate`, no new mutation string needed

- **Decision**: `advancePeriod()` calls `versionedUpdate(state => ({ currentPeriod: state.currentPeriod + 1, clockSeconds: periodSeconds, homeFouls: 0, guestFouls: 0 }))`.
- **Rationale**: `UPDATE_GAME_STATE_VERSIONED_MUTATION` already accepts all four fields as nullable parameters. No new mutation string needed.
- **Alternatives considered**: Dedicated `UPDATE_PERIOD_ADVANCE_MUTATION` — rejected (duplicates the entire versioned mutation for no gain).

### Decision 2: Sequential `timer_sync` update after CAS, not atomic

- **Decision**: After `versionedUpdate` returns `true`, call `CONTROL_TIMER_MUTATION` to set `timer_sync` to stopped + `clockSeconds = periodSeconds`.
- **Rationale**: Hasura batched mutations are not atomic across tables (each is its own transaction). Ordering guarantee (game_states first, timer_sync second) is sufficient — if CAS fails the timer is untouched, which is correct.
- **Alternatives considered**: PostgreSQL function wrapping both in a transaction — rejected per Principle VII (no new SQL migrations for a two-step sequential write already used everywhere else).

### Decision 3: `advancePeriod()` owns the timer reset; `nextPeriod()` no longer calls `stopTimer()`

- **Decision**: Timer reset is handled inside `advancePeriod()` after CAS success, not as a separate call in `nextPeriod()`.
- **Rationale**: The current `stopTimer()` call at the end of `nextPeriod()` races with the mutations before it. Moving the timer reset inside `advancePeriod()` guarantees order: CAS succeeds → timer stopped and reset.

### Decision 4: Tests appended to existing concurrent test file

- **Decision**: T108–T112 added to `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`.
- **Rationale**: The mock infrastructure for `graphqlRequest`, `gameState`, and `timerState` is already in place there.

## Phase 1: Design

### Data Model Changes

None. `game_states` and `timer_sync` schemas are unchanged. `version` counter behaviour is unchanged.

### Interface: `advancePeriod()` Hook Method

New function added to the object returned by `useHasuraGame`:

```typescript
/**
 * Atomically advances to the next period.
 * - Increments currentPeriod by 1
 * - Resets clockSeconds to periodSeconds (or 600 default)
 * - Resets homeFouls and guestFouls to 0
 * All via a single versioned CAS mutation — no false conflicts.
 * After CAS succeeds, resets timer_sync to stopped + periodSeconds.
 */
advancePeriod: () => Promise<boolean>
```

### Implementation Sketch: `advancePeriod()` in `use-hasura-game.ts`

```typescript
const advancePeriod = useCallback(async (): Promise<boolean> => {
  if (!gameState) return false;
  const periodSeconds = gameState.periodSeconds ?? 600;

  // 1. Single versioned CAS: bump period, reset clock + fouls atomically
  const success = await versionedUpdate(state => ({
    currentPeriod: state.currentPeriod + 1,
    clockSeconds: periodSeconds,
    homeFouls: 0,
    guestFouls: 0,
  }));

  if (!success) return false;

  // 2. Reset timer_sync (only runs after CAS succeeds)
  const now = new Date().toISOString();
  await graphqlRequest(CONTROL_TIMER_MUTATION, {
    gameId,
    isRunning: false,
    startedAt: null,
    initialClockSeconds: periodSeconds,
    currentClockSeconds: periodSeconds,
    updatedAt: now,
    updatedBy: userId || 'anonymous',
  });

  return true;
}, [gameState, gameId, userId, versionedUpdate]);
```

### `nextPeriod()` Change in `page.tsx`

```typescript
// BEFORE
const nextPeriod = () => {
  if (!game) return;
  updateGame({
    currentPeriod: game.currentPeriod + 1,
    homeFouls: 0,
    guestFouls: 0,
    clockSeconds: game.periodSeconds || 600,
  });
  addEvent({ ... });
  if (isTimerRunning) stopTimer();
};

// AFTER
const nextPeriod = async () => {
  if (!game) return;
  const ok = await advancePeriod(); // atomic CAS + timer reset
  if (!ok) return;
  addEvent({
    type: 'period_start',
    team: 'home',
    player: 'System',
    value: 0,
    description: `Start of Period ${game.currentPeriod + 1}`,
    period: game.currentPeriod + 1,
    clockAt: game.periodSeconds || 600,
  });
};
```

`updateGame()` is unchanged — score, foul, and timeout updates continue to use their existing paths.

### Test Cases (T108–T112)

| ID | Scenario | Key Assertions |
|----|----------|----------------|
| T108 | Single scorer advances period (timer stopped) | `currentPeriod` +1, `clockSeconds` = periodSeconds, `homeFouls/guestFouls` = 0, conflict NOT signalled, `CONTROL_TIMER_MUTATION` called with `isRunning: false` |
| T109 | Single scorer advances period (timer running) | Same as T108; timer_sync reset happens after CAS, not before |
| T110 | Another scorer updated score between period advance attempt and retry | `versionedUpdate` retries once (150ms), succeeds on retry — conflict NOT signalled |
| T111 | Another scorer already advanced same period (double-click race) | After retry `affected_rows` still 0 → `signalConflict` called exactly once |
| T112 | Regression: `updateScore` and `updateFouls` still conflict-detect on stale version | Existing T093/T095 assertions continue to pass |

### Verification

1. `npx tsc --noEmit` — no new TypeScript errors (same 2 pre-existing errors in unrelated files)
2. `npm test` — all existing tests pass; T108–T112 pass
3. Manual smoke: `bun run dev`, click "Start Next Period" — no conflict banner, clock resets to period duration, timer stopped
