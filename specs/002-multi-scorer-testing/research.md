# Research: Multi-Scorer Concurrent Testing & Fixes

**Feature**: 002-multi-scorer-testing  
**Date**: 2026-03-01

## Research Questions & Findings

### R1: How does the current PATCH handler work and what's missing?

**Decision**: PATCH handler at `src/app/api/games/[id]/events/route.ts` (lines 203-258) updates event fields but performs **no score/foul recalculation** when values change. This is a confirmed bug.

**Rationale**: The DELETE handler (lines 126-194) correctly subtracts old values from `games` and `gameRosters` tables, then syncs to Hasura. PATCH must follow the same pattern but with a reverse-old/apply-new approach.

**Fix approach**:
1. Fetch the old event before updating
2. If `type` or `value` changed and old event was a `score`: subtract old value from game/roster totals
3. If `type` or `value` changed and new event is a `score`: add new value to game/roster totals
4. Same logic for `foul` type changes
5. Sync updated totals to Hasura via `UPSERT_GAME_STATE_MUTATION`

**Alternatives considered**:
- Full recalculation on every PATCH: Rejected — too expensive for single-field edits; full recalc already happens at trigger points as safety net
- Ignore PATCH recalc, rely only on trigger-point recalc: Rejected — users expect immediate visual feedback when editing an event

---

### R2: Where are period/status change entry points for recalculation triggers?

**Decision**: Two layers need modification — the frontend hook and the scorer page.

**Findings**:
- `src/hooks/use-hasura-game.ts`: `updatePeriod()` (line ~739) and `updateGameStatus()` (line ~778) send versioned mutations to Hasura. These are the hook-level entry points.
- `src/app/game/[id]/scorer/page.tsx`: `nextPeriod()` (line ~471) and `handleEndGame()` (line ~499) are the UI-level handlers that call the hook functions.

**Rationale**: Recalculation should happen server-side (via API call to new `/api/games/[id]/recalculate` endpoint) triggered by the scorer page before or after the period/status change. This keeps the hook layer thin and the recalculation logic centralized.

**Trigger point implementation**:
| Trigger | Where Called | When to Recalc |
|---------|-------------|----------------|
| Period change | `nextPeriod()` in scorer page | After period increment, before UI confirms |
| Halftime | `nextPeriod()` when period = totalPeriods/2 | Same as period change |
| Game finalization | `handleEndGame()` in scorer page | Before status set to 'final' |
| Timeout | `updateTimeouts()` in hook | After timeout recorded |
| Scorer reconnection | `useHasuraGame` subscription reconnect | On WebSocket reconnect callback |
| Manual button | New force-recalc button in scorer header | On click |

---

### R3: What notification system should be used for recalculation feedback?

**Decision**: Use a lightweight state-based toast component following the existing `conflictDetected` pattern in the scorer page (line ~700). No new library needed.

**Rationale**: The codebase has no toast library installed (no sonner, react-hot-toast, etc.). The existing conflict indicator pattern uses conditional rendering with auto-dismiss via `setTimeout` — this is sufficient and consistent.

**Alternatives considered**:
- Install `sonner`: Rejected — constitution Principle VII (Incremental Complexity) requires justification for new dependencies; a simple state-based approach works fine
- Use browser `alert()`: Rejected — blocks UI thread, poor UX during live scoring

**Implementation pattern** (from existing `conflictDetected`):
```tsx
// State
const [recalcResult, setRecalcResult] = useState<{ corrected: boolean; details: string } | null>(null);

// Auto-dismiss after 5 seconds
useEffect(() => {
  if (recalcResult) {
    const timer = setTimeout(() => setRecalcResult(null), 5000);
    return () => clearTimeout(timer);
  }
}, [recalcResult]);

// Render
{recalcResult && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 ...">
    {recalcResult.corrected ? '⚠️ Score corrected' : '✓ Scores verified'}
  </div>
)}
```

---

### R4: How should the full recalculation function work?

**Decision**: Create `recalculateGameTotals(gameId)` in `src/services/game.ts` that derives all totals from `gameEvents` using SQL aggregation, updates `games` and `gameRosters` tables, syncs to Hasura, and returns a discrepancy report.

**Rationale**: The existing codebase uses client-side `reduce()` for aggregation (no SQL SUM queries exist). For recalculation, SQL aggregation is more reliable and efficient — a single query can sum all score events grouped by team.

**Algorithm**:
1. Query: `SELECT team, SUM(value) FROM game_events WHERE game_id = ? AND type = 'score' GROUP BY team`
2. Query: `SELECT team, COUNT(*) FROM game_events WHERE game_id = ? AND type = 'foul' GROUP BY team`
3. Query: `SELECT name, team, SUM(CASE WHEN type='score' THEN value ELSE 0 END) as points, SUM(CASE WHEN type='foul' THEN 1 ELSE 0 END) as fouls FROM game_events WHERE game_id = ? AND (type='score' OR type='foul') GROUP BY name, team`
4. Compare with current `games` table values
5. If discrepancy: update `games`, update `gameRosters`, log details, set `corrected = true`
6. Sync to Hasura via `UPSERT_GAME_STATE_MUTATION`
7. Return `{ corrected, oldValues, newValues, trigger, gameId }`

**Alternatives considered**:
- Drizzle ORM aggregation: Drizzle supports `sql` template literals for raw aggregation — use this rather than raw SQL strings
- Full event replay in application code: Rejected — SQL aggregation is atomic and handles edge cases (NULL values, deleted events) better

---

### R5: What is the recalculate API endpoint design?

**Decision**: `POST /api/games/[id]/recalculate` — requires `canManageGame()` permission, calls `recalculateGameTotals()`, returns discrepancy report.

**Rationale**: POST (not GET) because it has side effects (may update totals). Separate from the events route to keep concerns clean. Uses existing permission pattern.

**Response shape**:
```json
{
  "corrected": true,
  "oldValues": { "homeScore": 12, "guestScore": 8, "homeFouls": 3, "guestFouls": 2 },
  "newValues": { "homeScore": 14, "guestScore": 8, "homeFouls": 3, "guestFouls": 2 },
  "trigger": "manual",
  "gameId": "uuid"
}
```

---

### R6: How should existing test files be extended?

**Decision**: Add new `describe` blocks to existing test files, continuing the T-series numbering.

**Findings from existing patterns**:
- `use-hasura-game.concurrent.test.ts` (567 lines): Uses T093-T098 numbering, `buildCasMock()` for CAS simulation, `setupSubscriptions()` for subscription handler capture
- `concurrent-scorers.test.ts` (244 lines): Load tests with `setupHook()` helper, `buildCasMock()` for serialized concurrent updates

**New test blocks to add**:
| File | New Test IDs | Coverage |
|------|-------------|----------|
| `use-hasura-game.concurrent.test.ts` | T099-T106 | PATCH recalc, full recalc at triggers, discrepancy detection, reconnection recalc, role enforcement, rapid-fire state updates |
| `concurrent-scorers.test.ts` | New describe block | 3+ scorer recalc, force-recalc during concurrent updates, viewer mutation rejection under load |
| `regression.test.ts` | New cases | PATCH recalc regression (Bug-3), full recalc correctness |

**Test helpers to add to `test-utils.ts`**:
- `buildDriftedGameState()`: Creates a game state with intentional score drift
- `buildRecalcMock()`: Mocks the recalculate API endpoint response
- `assertScoreIntegrity()`: Compares hook state totals against expected event sums
