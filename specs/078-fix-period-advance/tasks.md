# Tasks: Fix Period Advance — Conflict & Timer Reset

**Feature**: 078-fix-period-advance  
**Branch**: `078-fix-period-advance`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1 — Hook: Add `advancePeriod()`

### T1.1 — Add `advancePeriod` function to `use-hasura-game.ts`

**File**: `src/hooks/use-hasura-game.ts`  
**After**: `stopTimer` function (line ~697)

Add a new `useCallback` function `advancePeriod` that:
1. Guards on `gameState` being non-null
2. Reads `periodSeconds` from `gameState.periodSeconds ?? 600`
3. Calls `versionedUpdate(state => ({ currentPeriod: state.currentPeriod + 1, clockSeconds: periodSeconds, homeFouls: 0, guestFouls: 0 }))`
4. Returns `false` immediately if CAS fails
5. Calls `graphqlRequest(CONTROL_TIMER_MUTATION, { gameId, isRunning: false, startedAt: null, initialClockSeconds: periodSeconds, currentClockSeconds: periodSeconds, updatedAt: now, updatedBy: userId || 'anonymous' })`
6. Returns `true`

Dependencies for `useCallback`: `[gameState, gameId, userId, versionedUpdate]`

### T1.2 — Export `advancePeriod` from hook return value

**File**: `src/hooks/use-hasura-game.ts`  
**In**: the `return { ... }` object at the bottom

Add `advancePeriod` to the returned object, alongside existing methods.

---

## Phase 2 — Page: Refactor `nextPeriod()`

### T2.1 — Destructure `advancePeriod` from hook

**File**: `src/app/game/[id]/scorer/page.tsx`  
**In**: the destructuring of `useHasuraGame(id as string)` (~line 96)

Add `advancePeriod` to the destructured names. Remove `stopTimer` from the destructure only if it is no longer used anywhere else on the page (it is still used in `handleEndGame` and `handleTimeout`, so keep it).

### T2.2 — Replace `nextPeriod` body

**File**: `src/app/game/[id]/scorer/page.tsx`  
**Current** (~line 471):
```typescript
const nextPeriod = () => {
  if (!game) return;
  updateGame({ currentPeriod: ..., homeFouls: 0, guestFouls: 0, clockSeconds: ... });
  addEvent({ ... });
  if (isTimerRunning) stopTimer();
};
```

**New** (~line 471):
```typescript
const nextPeriod = async () => {
  if (!game) return;
  const ok = await advancePeriod();
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

Note: `updateGame` and `stopTimer` calls are removed from `nextPeriod`. `stopTimer` remains available via hook for `handleEndGame` and `handleTimeout`.

---

## Phase 3 — Tests: T108–T112

### T3.1 — Append T108: Single scorer advances period (timer stopped)

**File**: `src/hooks/__tests__/use-hasura-game.concurrent.test.ts`  
**Where**: After final `});` on line 1569

New `describe("T108 — advancePeriod: timer stopped", ...)` block:
- Render hook with `gameState` at version 1, `timerState` stopped
- Mock `graphqlRequest`: `UpdateGameStateVersioned` → success (`affected_rows: 1`); `ControlTimer` → `{}`
- Call `result.current.advancePeriod()`
- Assert: `graphqlRequest` called with `UpdateGameStateVersioned` containing `currentPeriod: 2`, `clockSeconds: 600`, `homeFouls: 0`, `guestFouls: 0`
- Assert: `graphqlRequest` called with `ControlTimer` containing `isRunning: false`, `currentClockSeconds: 600`
- Assert: `conflictDetected` is `false`
- Assert: return value is `true`

### T3.2 — Append T109: Single scorer advances period (timer running)

Same as T108 but `timerState` has `isRunning: true`. Assertions identical — timer reset must still happen after CAS succeeds.

### T3.3 — Append T110: Concurrent update between attempt and retry (no conflict)

New `describe("T110 — advancePeriod: retry succeeds on concurrent update")`:
- First `UpdateGameStateVersioned` call returns `affected_rows: 0`
- After 150ms delay, subscription pushes fresh state (version 2)
- Second call returns `affected_rows: 1`
- Assert: `signalConflict` NOT called (conflictDetected remains false)
- Assert: return value is `true`

### T3.4 — Append T111: Double-click race — same period already advanced

New `describe("T111 — advancePeriod: double-click race signals conflict")`:
- All `UpdateGameStateVersioned` calls return `affected_rows: 0`
- Assert: `signalConflict` called exactly once (conflictDetected becomes true)
- Assert: return value is `false`

### T3.5 — Append T112: Regression — updateScore/updateFouls still conflict-detect

New `describe("T112 — regression: updateScore/updateFouls still conflict on stale version")`:
- Verify existing T093/T095 behaviour is unaffected
- `updateScore` with stale version → `affected_rows: 0` → retry → success → no conflict
- `updateFouls` with stale version → `affected_rows: 0` → retry → success → no conflict
- These are regression guards: adding `advancePeriod` must not change existing versioned paths

---

## Phase 4 — Verification

### T4.1 — TypeScript check

Run: `npx tsc --noEmit`  
Expected: 0 new errors (2 pre-existing errors in unrelated files are acceptable)

### T4.2 — Test suite

Run: `npm test`  
Expected: All tests pass including T108–T112

---

## Implementation Order

1. T1.1 → T1.2 (hook)
2. T2.1 → T2.2 (page)
3. T3.1 → T3.5 (tests)
4. T4.1 → T4.2 (verify)
