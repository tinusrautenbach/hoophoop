# Research: Fix Period Advance — Conflict & Timer Reset

**Feature**: `078-fix-period-advance`  
**Date**: 2026-03-02

## Finding 1: Root Cause — Three Sequential Non-Versioned Mutations

**Decision**: Fix by replacing the three calls with a single `versionedUpdate` call.

**Evidence from codebase** (`src/app/game/[id]/scorer/page.tsx`, `nextPeriod()` → `updateGame()`):
1. `updatePeriod()` — calls `UPDATE_PERIOD_MUTATION` (blind upsert, increments server `version` to N+1)
2. `updateClock()` — calls `UPDATE_CLOCK_MUTATION` (blind upsert, increments server `version` to N+2)
3. `updateFouls('home')` → `versionedUpdate(state => ..., expectedVersion: N)` — server is now at N+2, `affected_rows: 0` → false conflict
4. `stopTimer()` — never reached cleanly; timer_sync never gets reset

**Rationale**: The existing `UPDATE_GAME_STATE_VERSIONED_MUTATION` already accepts `currentPeriod`, `clockSeconds`, `homeFouls`, `guestFouls` as nullable `_set` parameters with a single `where: { version: { _eq: $expectedVersion } }` clause. The fix requires zero new GraphQL — only the call site changes.

## Finding 2: Hasura Batched Mutations Are Not Atomic Across Tables

**Decision**: Update `game_states` first (versioned CAS), then `timer_sync` (blind upsert) sequentially.

**Evidence**: Hasura executes each mutation in a batch as a separate transaction. There is no cross-table rollback. A custom PostgreSQL function could wrap both in one transaction, but this would require a Drizzle migration and Hasura metadata export — disproportionate to the problem.

**Rationale**: The sequential pattern (CAS succeeds → timer reset) is already used for every other timer operation in the codebase (`stopTimer`, `startTimer` both update `game_states` then `timer_sync`). Consistency with existing pattern is better than introducing a new SQL function.

## Finding 3: `timer_sync` Must Get `currentClockSeconds = periodSeconds` on Period Advance

**Decision**: Pass `initialClockSeconds: periodSeconds, currentClockSeconds: periodSeconds` to `CONTROL_TIMER_MUTATION` after CAS.

**Evidence** (`use-hasura-game.ts`, `calculateClock` display function):
```typescript
const calculateClock = () => {
  if (timerState?.isRunning && timerState?.startedAt) {
    return Math.max(0, timerState.initialClockSeconds - Math.floor((Date.now() - timerState.startedAt) / 1000));
  }
  return timerState?.currentClockSeconds ?? gameState?.clockSeconds ?? 600;
};
```
When the timer is stopped, the display falls back to `timerState.currentClockSeconds`. If `CONTROL_TIMER_MUTATION` is not called with the new `periodSeconds`, the clock display will remain at whatever the previous period's remaining time was.

## Finding 4: Existing Tests — Coverage Gaps

**Covered** (in `use-hasura-game.concurrent.test.ts`):
- T093–T098: Concurrent score/foul updates, version retries, sequential consistency
- T097: Timer race conditions (start/stop idempotency)
- T100: Period change acknowledged but fix not implemented (test marked pending)

**Not covered** (gaps this feature fills with T108–T112):
- `nextPeriod()` / `advancePeriod()` happy path
- Period advance with timer running
- Retry succeeds on first retry (no conflict signal)
- Retry fails on second attempt (conflict signal fires)
- Regression: existing score/foul conflict detection unaffected
