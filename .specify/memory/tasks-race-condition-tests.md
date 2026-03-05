# Tasks: Race-Condition & Concurrency Test Framework

**Input**: `src/hooks/use-hasura-game.ts`, `src/app/api/games/[id]/events/route.ts`, `src/lib/hasura/client.ts`, `src/db/schema.ts`, spec/test_policy.md, `.specify/memory/spec.md`, `.specify/memory/plan.md`
**Generated**: 2026-02-28
**Status**: Outstanding — not yet implemented

**Purpose**: Three production bugs were observed scoring a live game from a phone:
- **Bug 1**: "Scoring deadlock" shown when only ONE scorer is present
- **Bug 2**: Scoring events appear in the event log but total score does NOT update
- **Bug 3**: Timer start fails intermittently

This document defines all tasks to:
1. **Fix the three bugs** (root causes identified)
2. **Build a comprehensive race-condition test framework** that catches these and related concurrency issues

---

## Format: `[ID] [P?] [Category] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Category]**: `BUG-FIX`, `TEST-INFRA`, `UNIT-TEST`, `INTEGRATION-TEST`, `LOAD-TEST`
- All paths relative to repo root

---

## Root Cause Summary (Do Not Skip)

### Bug 1 — False "Scoring Deadlock" (single scorer)
- **File**: `src/hooks/use-hasura-game.ts` lines 591–623 (`versionedUpdate`)
- **Root cause**: After `maxRetries = 1` exhausted, `signalConflict()` is called unconditionally regardless of how many scorers are active. On mobile, if the Hasura WebSocket reconnects after `versionedUpdate` sends its first attempt, the subscription delivers a fresh `gameState` with the same version number that was already used. The re-read at line `currentState = gameState` still has the old version (closure snapshot was already captured before reconnect delivered the update), so `affected_rows = 0` on both attempts → deadlock message fires.
- **Secondary cause**: `INIT_GAME_STATE_MUTATION` (called inside `startTimer`, line 693) is a blind upsert that increments version by rewriting the entire row, which can bump the version the scorer's next `versionedUpdate` expects — causing an artificial conflict on the very first score attempt.

### Bug 2 — Events show, score doesn't update
- **File**: `src/app/api/games/[id]/events/route.ts` lines 34–90 (POST handler)
- **Root cause**: The `POST /api/games/[id]/events` handler inserts the event row to `gameEvents` (Drizzle direct), but **never updates `games.homeScore`/`guestScore` nor calls `UPSERT_GAME_STATE_MUTATION`** to sync `game_states`. Hasura subscription shows the new event (from `hasura_game_events`) but `game_states.homeScore` is unchanged — so the scoreboard never moves.
- The DELETE handler **does** recalculate scores and sync to Hasura (lines 127–194). The POST handler is the gap.
- **Secondary path**: The scorer UI calls `addEvent()` (inserts `hasura_game_events` via GraphQL) AND `updateScore()` (`versionedUpdate` on `game_states`) as two **separate, non-atomic** operations. If `updateScore()` fails after its single retry (version conflict), the event row exists but `game_states` is never incremented.

### Bug 3 — Timer start fails intermittently
- **File**: `src/hooks/use-hasura-game.ts` lines 645–668 (`startTimer`)
- **Root cause**: `startTimer` calls `graphqlRequest(CONTROL_TIMER_MUTATION, ...)` with **no try/catch**. `graphqlRequest` throws on HTTP errors (line 108 in `client.ts`). On mobile, where the Hasura HTTP endpoint may be momentarily unreachable during WebSocket reconnect, the thrown error propagates uncaught — the button press appears to do nothing.
- **Secondary cause**: If both `timerState` and `gameState` subscriptions are null at invocation (first load or reconnect), `clockToResume` defaults to `600` (hardcoded), silently resetting the clock.

---

## Phase A: Bug Fixes (Must Do First)

### A1 — Fix POST /events: Add Score Sync After Event Insert

- [ ] T077 [BUG-FIX] In `route.ts` POST handler (after `db.insert(gameEvents)`): fetch updated game scores from Drizzle, then call `UPSERT_GAME_STATE_MUTATION` to sync `game_states`. Match the pattern already used by the DELETE handler (lines 180–194). **File**: `src/app/api/games/[id]/events/route.ts`

  **Acceptance criteria**:
  - After POST `/api/games/:id/events` with `type: 'score'`, the `game_states.homeScore` or `game_states.guestScore` in Hasura is incremented by `value` within the same request-response cycle
  - Hasura sync failure must be non-fatal (log but do not 500 — Postgres is source of truth)
  - Existing unit tests continue to pass

- [ ] T078 [P] [BUG-FIX] Add score recalculation to `updateScore()` in `src/hooks/use-hasura-game.ts`: if `versionedUpdate` returns `false` after exhausting retries, **re-fetch** the latest `game_states` version via a one-shot query and retry once more before calling `signalConflict()`. This makes the client-side path resilient to a single stale subscription snapshot.

  **Acceptance criteria**:
  - When `versionedUpdate` receives `affected_rows: 0` and the **actual reason** is a stale version (not a true concurrent conflict), the refetch+retry succeeds
  - `signalConflict()` is only called when a genuine concurrent conflict is detected (i.e., after refetch still returns 0)

### A2 — Fix False Deadlock (single scorer)

- [ ] T079 [BUG-FIX] Add active-scorer count guard to `signalConflict` invocation inside `versionedUpdate`. Before calling `signalConflict()`, check if `activeScorers.length <= 1`. If so, attempt a fresh-fetch retry instead of signaling conflict. **File**: `src/hooks/use-hasura-game.ts`

  **Acceptance criteria**:
  - With `activeScorers.length === 1`, no "scoring deadlock" toast/banner appears even if `versionedUpdate` fails on first attempt due to subscription lag
  - With `activeScorers.length >= 2` and genuine version clash, conflict banner still shows

- [ ] T080 [P] [BUG-FIX] Fix `INIT_GAME_STATE_MUTATION` blind upsert in `startTimer` (line 693): replace with a version-aware upsert that only overwrites `isTimerRunning` without resetting `version`. **File**: `src/hooks/use-hasura-game.ts`

  **Acceptance criteria**:
  - Calling `startTimer` does not bump `game_states.version` in a way that invalidates a concurrent scorer's `expectedVersion`
  - Verified by checking `version` value in `game_states` before and after `startTimer` call in tests

### A3 — Fix Timer Start Intermittent Failure

- [ ] T081 [BUG-FIX] Wrap `graphqlRequest(CONTROL_TIMER_MUTATION, ...)` call in `startTimer` with a try/catch. On catch: retry once after 200ms, then surface an error toast to the user. **File**: `src/hooks/use-hasura-game.ts`

  **Acceptance criteria**:
  - When `graphqlRequest` throws (simulated network error), `startTimer` does not crash silently; it shows a user-visible error or retries
  - No unhandled promise rejection in browser console

- [ ] T082 [P] [BUG-FIX] Guard against null `timerState` + null `gameState` in `startTimer`. If both are null, `startTimer` should throw/warn and NOT send mutation with `initialClockSeconds: 600`. Instead, it should wait up to 1 second for subscriptions to hydrate before proceeding. **File**: `src/hooks/use-hasura-game.ts`

  **Acceptance criteria**:
  - Calling `startTimer` before subscriptions have delivered their first event does NOT reset the clock to 600
  - Test: call `startTimer` immediately after hook mount (before subscriptions fire) — the mutation is either delayed or blocked until real state arrives

---

## Phase B: Test Infrastructure

*All test infrastructure lives in `src/` co-located with source, or in `tests/` for integration/load tests (following existing conventions in `vitest.config.ts`).*

### B1 — Controllable Hasura Mock Factory

- [ ] T083 [TEST-INFRA] Create `src/lib/hasura/__tests__/test-utils.ts` — a reusable mock factory for `graphqlRequest` and `getHasuraWsClient` with controllable timing. Exports:
  - `createControllableSubscription(queryIncludes: string)`: returns a mock subscription where you can manually call `.push(data)` to deliver subscription events at controlled times
  - `createDelayedGraphqlRequest(delayMs: number)`: wraps `graphqlRequest` mock to simulate network latency
  - `createFailingGraphqlRequest(failOnNthCall: number)`: rejects on the Nth call, succeeds otherwise
  - `createVersionedGameState(overrides?)`: returns a full valid `GameState` object with `version: 1` and default scores

  **Acceptance criteria**:
  - Factory functions are typed with full TypeScript — no `any`
  - All exports can be imported in both hook tests and route tests
  - JSDoc comment on each export explaining its race-condition use case

- [ ] T084 [P] [TEST-INFRA] Create `src/app/api/games/[id]/events/__tests__/test-utils.ts` — shared test helpers for the events route:
  - `createMockGame(overrides?)`: returns a valid `games` DB row
  - `createMockEvent(overrides?)`: returns a valid `gameEvents` DB row with `type: 'score'`
  - `createMockDb()`: returns a vitest mock of the Drizzle `db` object with all `.insert`, `.update`, `.delete`, `.query` mocked
  - `createMockHasuraSync()`: returns a mock of the `graphqlRequest` call used for Hasura sync (to verify it was called with correct score values)

  **Acceptance criteria**:
  - Used by T085–T092 (route unit tests) and T093–T098 (integration tests)
  - No duplication with existing mocks in `route.test.ts`

### B2 — Vitest Concurrency Helpers

- [ ] T085 [TEST-INFRA] Create `tests/utils/concurrent.ts` — concurrency test helpers:
  - `raceN(n: number, fn: () => Promise<unknown>)`: fires `n` concurrent calls to `fn`, returns array of settled results
  - `withJitter(fn: () => Promise<unknown>, jitterMs: number)`: adds random delay 0–jitterMs before calling `fn` (simulates real-world non-deterministic timing)
  - `assertOnlyOneSucceeded(results: PromiseSettledResult[])`: asserts exactly 1 `fulfilled` among `n` results (for exclusive-write scenarios)
  - `assertAllSucceeded(results: PromiseSettledResult[])`: all `fulfilled`
  - `assertEventualConsistency(getter: () => Promise<T>, expected: T, timeoutMs: number)`: polls getter until value matches expected or timeout

  **Acceptance criteria**:
  - All helpers fully typed (generic where appropriate)
  - Used in T093–T110

---

## Phase C: Unit Tests — Bug Regression Coverage

### C1 — POST /events Route: Score Sync Tests

- [ ] T086 [UNIT-TEST] `src/app/api/games/[id]/events/__tests__/route.test.ts` — add test group `"POST /events — score sync"`:
  - **T086a**: POST with `type: 'score', team: 'home', value: 2` → asserts `db.update(games)` was called incrementing `homeScore` by 2
  - **T086b**: POST with `type: 'score', team: 'guest', value: 3` → asserts `guestScore` incremented by 3
  - **T086c**: POST with `type: 'foul'` → asserts score is NOT updated (only events table is written)
  - **T086d**: POST with valid score → asserts `UPSERT_GAME_STATE_MUTATION` (Hasura sync) was called with correct `homeScore`/`guestScore` values
  - **T086e**: POST where Hasura sync throws → asserts response is still `200 OK` (non-fatal) and event was saved to DB

- [ ] T087 [P] [UNIT-TEST] `src/app/api/games/[id]/events/__tests__/route.test.ts` — add test group `"DELETE /events — score decrement"` (regression for existing behaviour):
  - **T087a**: DELETE score event → `homeScore` decremented correctly
  - **T087b**: DELETE event that doesn't exist → `404`
  - **T087c**: DELETE foul event → fouls decremented, score untouched
  - **T087d**: DELETE last event → score reaches 0, not negative (floor at 0)

### C2 — versionedUpdate Unit Tests

- [ ] T088 [UNIT-TEST] `src/hooks/__tests__/use-hasura-game.test.ts` — add test group `"versionedUpdate — version conflict handling"`:
  - **T088a**: `graphqlRequest` returns `affected_rows: 1` on first attempt → `versionedUpdate` returns `true`, `signalConflict` NOT called
  - **T088b**: `graphqlRequest` returns `affected_rows: 0` on first attempt, `1` on retry → returns `true`, no conflict
  - **T088c**: `graphqlRequest` returns `affected_rows: 0` on both attempts → returns `false`, `signalConflict` IS called
  - **T088d**: `gameState` is `null` (subscription not yet hydrated) → returns `false`, `signalConflict` NOT called (null guard path)
  - **T088e**: Single scorer (`activeScorers.length === 1`), stale version → refetch succeeds → `signalConflict` NOT called (tests T079 fix)

- [ ] T089 [P] [UNIT-TEST] `src/hooks/__tests__/use-hasura-game.test.ts` — add test group `"updateScore — two-operation atomicity"`:
  - **T089a**: `addEvent()` succeeds AND `updateScore()` (`versionedUpdate`) succeeds → both operations called, score updated
  - **T089b**: `addEvent()` succeeds but `updateScore()` returns `false` (conflict) → event exists, score not updated — **documents the current gap** (will fail until T078 fix applied, mark with `// KNOWN BUG: T078`)
  - **T089c**: After T078 fix: `updateScore()` refetch retry path → score eventually updates after stale version

### C3 — startTimer Unit Tests

- [ ] T090 [UNIT-TEST] `src/hooks/__tests__/use-hasura-game.test.ts` — add test group `"startTimer — error handling"`:
  - **T090a**: `graphqlRequest` resolves successfully → `timerState.isRunning` becomes `true` after subscription update
  - **T090b**: `graphqlRequest` throws `Error('GraphQL request failed: 503')` → error is caught (not unhandled rejection), user-visible error state is set
  - **T090c**: `graphqlRequest` throws on first call, succeeds on retry → timer starts after retry
  - **T090d**: Both `timerState` and `gameState` are `null` at invocation → mutation is NOT sent (tests T082 fix)
  - **T090e**: `timerState.currentClockSeconds = 300` → mutation is called with `initialClockSeconds: 300`, NOT `600`

- [ ] T091 [P] [UNIT-TEST] `src/hooks/__tests__/use-hasura-game.test.ts` — add test group `"startTimer — version safety"`:
  - **T091a**: `startTimer` followed immediately by `updateScore` → `game_states.version` is consistent (not double-bumped)
  - **T091b**: `INIT_GAME_STATE_MUTATION` is called with correct `isTimerRunning: true` payload (tests T080 fix structure)

### C4 — graphqlRequest Client Unit Tests

- [ ] T092 [UNIT-TEST] `src/lib/hasura/__tests__/client.test.ts` — add test group `"graphqlRequest — error propagation"`:
  - **T092a**: HTTP 503 response → throws `Error('GraphQL request failed: Service Unavailable')`
  - **T092b**: HTTP 200 with `{ errors: [{ message: 'field not found' }] }` → throws `Error('field not found')`
  - **T092c**: Network-level fetch rejection → propagates rejection (does not swallow)
  - **T092d**: Successful response with `data` → returns `data` unwrapped

---

## Phase D: Integration Tests — Concurrent Scorer Scenarios

*Integration tests mock the Hasura HTTP endpoint and DB but run multiple hook instances concurrently using `renderHook` × N. They live in `src/hooks/__tests__/`.*

### D1 — Two-Scorer Concurrent Score Update

- [ ] T093 [INTEGRATION-TEST] `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` — test group `"two scorers — concurrent score update"`:

  **Setup**: Two `renderHook(() => useHasuraGame('game-123'))` instances share a single mocked `graphqlRequest`. The shared mock maintains a server-side `version` counter: the first caller wins, second gets `affected_rows: 0`.

  - **T093a**: Both scorers score simultaneously (`Promise.all([scorer1.updateScore(), scorer2.updateScore()])`) → total score incremented by exactly `value1 + value2` (both eventually succeed after retry)
  - **T093b**: Scorer 2 gets `affected_rows: 0` on first attempt, `1` on retry → `signalConflict` NOT called on scorer 2 (retry succeeded)
  - **T093c**: Both scorers fail all retries (version never matches) → both see conflict banner; score remains at initial value
  - **T093d**: Scorer 1 is on slow network (150ms delay on `graphqlRequest`) while scorer 2 scores instantly → scorer 1 retries with updated version and succeeds

- [ ] T094 [P] [INTEGRATION-TEST] `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` — test group `"two scorers — event deduplication"`:
  - **T094a**: Same `eventId` sent twice (simulating double-tap on mobile) → only one event row persists (`on_conflict do nothing` in `ADD_GAME_EVENT_MUTATION`)
  - **T094b**: Different `eventId` same-second events from two scorers → both events appear in log

### D2 — Version Stale State Scenario (Bug 1 Regression)

- [ ] T095 [INTEGRATION-TEST] `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` — test group `"single scorer — stale subscription"`:

  **Setup**: One scorer. `graphqlRequest` mock enforces `version: 1` on the server-side state. Subscription is delayed 300ms (simulating mobile reconnect lag).

  - **T095a**: Scorer scores before subscription delivers first event (`gameState === null`) → mutation not sent (null guard), no conflict banner
  - **T095b**: Scorer scores 50ms after subscription delivers `version: 1` state → mutation succeeds, no conflict banner
  - **T095c**: Scorer's subscription is 300ms stale (server already at `version: 2`) → versionedUpdate gets `affected_rows: 0`, refetch returns `version: 2`, retry succeeds → no conflict banner (validates T078 + T079 fix)

### D3 — Event Insert + Score Sync Atomicity (Bug 2 Regression)

- [ ] T096 [INTEGRATION-TEST] `src/app/api/games/[id]/events/__tests__/route.concurrent.test.ts` — test group `"POST /events — score sync correctness"`:

  **Setup**: Mock DB with an in-memory `homeScore` counter. Mock `graphqlRequest` captures the `UPSERT_GAME_STATE_MUTATION` call arguments.

  - **T096a**: Three concurrent `POST /events` calls with `type: 'score', team: 'home', value: 2` → DB `homeScore` ends at `initialScore + 6`; `UPSERT_GAME_STATE_MUTATION` called exactly 3 times with correct final score each time
  - **T096b**: POST with `type: 'score'` followed immediately by GET game → game response includes updated score (not stale pre-insert value)
  - **T096c**: POST event, then immediately GET `/api/games/:id` → `homeScore` in response reflects the new score

### D4 — Timer Race Conditions

- [ ] T097 [INTEGRATION-TEST] `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` — test group `"timer — concurrent start/stop"`:

  **Setup**: Two scorer hook instances sharing a mock `graphqlRequest` with a server-side `isRunning` flag.

  - **T097a**: Both scorers call `startTimer()` simultaneously → exactly one `CONTROL_TIMER_MUTATION` is sent (idempotent), timer ends up running
  - **T097b**: Scorer 1 starts timer while scorer 2 stops timer (race) → final state is deterministic (last write wins via `updatedAt` ordering — verify subscription shows consistent state)
  - **T097c**: `startTimer` called when WebSocket is reconnecting (`graphqlRequest` throws once) → retry kicks in, timer eventually starts
  - **T097d**: `startTimer` with `gameState = null` → blocked until subscription delivers state; clock value NOT reset to 600

### D5 — Version Counter Integrity Under Load

- [ ] T098 [INTEGRATION-TEST] `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` — test group `"version counter — sequential consistency"`:

  **Setup**: Shared in-memory `version` counter starting at `1`. `graphqlRequest` mock implements CAS (compare-and-swap): if `expectedVersion === currentVersion`, increment and return `affected_rows: 1`; else return `affected_rows: 0`.

  - **T098a**: 5 sequential score updates from one scorer → version ends at `6`, all succeed
  - **T098b**: 5 concurrent score updates from 5 different scorer instances → version ends at `6`; each scorer's retry loop ensures eventual success; no scorer is permanently blocked
  - **T098c**: 3 scorers, each doing 10 rapid score updates → final version = `31` (1 + 30 increments); final score = `initialScore + sum(all_values)`

---

## Phase E: Load & Stress Tests

*Load tests live in `tests/load/` per `spec/test_policy.md` section 6.2.*

### E1 — Multi-Scorer Load Test

- [ ] T099 [LOAD-TEST] `tests/load/concurrent-scorers.test.ts` — 10 simultaneous scorers on one game:

  **Setup**: 10 `renderHook` instances of `useHasuraGame('game-999')`. Shared `graphqlRequest` mock implements CAS version counter. Each scorer fires 20 score events over 2 seconds with random jitter 0–100ms.

  - **T099a**: All 200 score updates eventually succeed (all retries resolve within 2s timeout)
  - **T099b**: Final `game_states.version` = `201` (1 + 200 increments)
  - **T099c**: No scorer is permanently deadlocked (all `versionedUpdate` calls resolve `true` eventually)
  - **T099d**: `signalConflict` is never called (no false positives — every conflict is resolved by retry)

  **Performance threshold**: Entire test completes in < 5 seconds (200 operations with retry overhead)

- [ ] T100 [P] [LOAD-TEST] `tests/load/concurrent-scorers.test.ts` — stress test version contention:

  **Setup**: 5 scorers, each scoring 50 times, all targeting the same `game_states` row with CAS mock.

  - **T100a**: Under 100% contention (all 5 start simultaneously), average retry count per scorer < 5
  - **T100b**: 99th percentile single-update latency (including retries) < 300ms
  - **T100c**: Zero `signalConflict()` invocations across all 250 updates

### E2 — Subscription Delivery Stress Test

- [ ] T101 [LOAD-TEST] `tests/load/subscription-stress.test.ts` — subscription broadcast timing:

  **Setup**: Mock subscription that delivers 100 state updates in 1 second to a single `useHasuraGame` hook instance. Each update increments `version` by 1.

  - **T101a**: Hook processes all 100 subscription events without dropping any — final `gameState.version = 101`
  - **T101b**: No React state update batching issues — `gameState` in hook reflects each version after re-render
  - **T101c**: Memory usage does not grow unboundedly during 100 subscription events (no subscription leak)

### E3 — REST API Concurrent Event Insert Load Test

- [ ] T102 [LOAD-TEST] `tests/load/events-route-load.test.ts` — 50 concurrent POST /events:

  **Setup**: Mock Drizzle DB with in-memory score counters (no network). Mock `graphqlRequest` for Hasura sync. Fire 50 concurrent POST requests.

  - **T102a**: All 50 inserts complete without error
  - **T102b**: `homeScore` in the mock DB = `initialScore + sum(all_values_in_requests)` — no lost updates
  - **T102c**: `UPSERT_GAME_STATE_MUTATION` called exactly 50 times (once per successful insert)
  - **T102d**: Test runs in < 2 seconds (pure in-memory, no I/O)

---

## Phase F: Regression Test Suite

*Ensures the three bugs never regress. These are the canonical "acceptance tests" for the bug fixes.*

- [ ] T103 [P] [UNIT-TEST] `src/app/api/games/[id]/events/__tests__/regression.test.ts` — **Bug 2 regression**:
  - `POST /events` with `type: 'score'` → `UPSERT_GAME_STATE_MUTATION` is called (score synced to Hasura)
  - Title: `"REGRESSION: Bug-2 — score event insert must sync game_states"`

- [ ] T104 [P] [UNIT-TEST] `src/hooks/__tests__/regression.test.ts` — **Bug 1 regression**:
  - Single scorer, stale `version` (subscription lag) → no `signalConflict()` call
  - Title: `"REGRESSION: Bug-1 — stale version with single scorer must not trigger conflict banner"`

- [ ] T105 [P] [UNIT-TEST] `src/hooks/__tests__/regression.test.ts` — **Bug 3 regression**:
  - `startTimer()` with `graphqlRequest` throwing once → error is caught, no unhandled rejection
  - Title: `"REGRESSION: Bug-3 — startTimer must not crash on network error"`

---

## Phase G: Test Documentation

- [ ] T106 [P] [writing] Update `spec/test_policy.md` — add section **"7. Concurrency & Race-Condition Tests"** covering:
  - When to write concurrent tests (any code that calls `versionedUpdate`, `addEvent`, timer mutations)
  - Required test cases for each new scorer-facing mutation
  - How to use `createControllableSubscription` and `raceN` helpers (T083/T085)
  - Link to `tests/load/` for load test templates

- [ ] T107 [P] [writing] Add `tests/TEST_COVERAGE_SUMMARY.md` entry for the race-condition framework:
  - Summary table: test file → bugs covered → test count
  - Run command: `npm test -- --reporter=verbose src/hooks/__tests__/use-hasura-game.concurrent.test.ts`

---

## Execution Order

Tasks MUST be executed in this order (dependencies respected):

```
Phase A (Bug Fixes) → Phase B (Test Infra) → Phase C (Unit Tests) → Phase D (Integration) → Phase E (Load) → Phase F (Regression) → Phase G (Docs)
```

Within each phase, all `[P]` tasks can run in parallel.

**Critical Path**:
```
T077 (fix POST score sync) → T086 (unit test for T077 fix)
T079 (fix false deadlock) + T078 (retry on stale) → T088e + T095c (regression)
T081 (fix startTimer catch) + T082 (null guard) → T090b + T090d (regression)
T083 (mock factory) → T088–T092, T093–T098 (all use mocks)
T085 (concurrent helpers) → T093–T102 (concurrent/load tests)
```

---

## Task Summary

| Phase | Focus | Tasks | Priority |
|-------|-------|-------|----------|
| Phase A | Bug fixes (3 production bugs) | T077–T082 | **Critical** |
| Phase B | Test infrastructure (mock factories, helpers) | T083–T085 | **Critical** |
| Phase C | Unit test regression coverage | T086–T092 | P1 |
| Phase D | Integration tests (concurrent scenarios) | T093–T098 | P1 |
| Phase E | Load & stress tests | T099–T102 | P2 |
| Phase F | Regression test suite (named regressions) | T103–T105 | P1 |
| Phase G | Test documentation | T106–T107 | P3 |

**Total tasks**: 31 (T077–T107)
**Parallelizable tasks [P]**: 18
**Sequential (dependency chain)**: 13

---

## Notes

- All new test files follow the convention in `spec/test_policy.md` §5: sibling `__tests__/` directory
- Load tests follow `spec/test_policy.md` §6.2: stored in `tests/load/`
- TypeScript strict mode — no `as any`, no `@ts-ignore`
- Mock `graphqlRequest` always via `vi.mock("@/lib/hasura/client")` — never call real Hasura in unit/integration tests
- `createControllableSubscription` (T083) is the key enabler for race-condition tests — implement it first within Phase B
- Bug fixes (Phase A) should be committed independently before test framework (Phase B+) to enable clean bisection if regressions are introduced
- Run full test suite after each Phase A fix: `npm test`
