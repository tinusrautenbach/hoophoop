# Quickstart: Multi-Scorer Concurrent Testing & Fixes

**Feature**: 002-multi-scorer-testing  
**Date**: 2026-03-01

## Prerequisites

- Node.js 18+
- PostgreSQL database running (or connection to dev instance)
- Environment variables configured (`.env.local` with `DATABASE_URL`, Clerk keys)
- Hasura instance running with metadata synced

## Development Setup

```bash
# Switch to feature branch
git checkout 002-multi-scorer-testing

# Install dependencies (if needed)
bun install

# Run dev server (for manual UI testing)
bun run dev
```

## Running Tests

```bash
# Run all tests
bun run test

# Run only concurrent scorer tests
npx vitest run src/hooks/__tests__/use-hasura-game.concurrent.test.ts

# Run only load tests (manual — not in CI)
npx vitest run tests/load/concurrent-scorers.test.ts

# Run regression tests
npx vitest run src/hooks/__tests__/regression.test.ts

# Run event route tests (includes PATCH recalculation)
npx vitest run src/app/api/games/[id]/events/__tests__/route.test.ts

# Run game service tests (includes recalculateGameTotals)
npx vitest run src/services/__tests__/game.test.ts
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/services/game.ts` | Score calculation utilities + new `recalculateGameTotals()` |
| `src/app/api/games/[id]/events/route.ts` | Event CRUD — PATCH handler fix lives here |
| `src/app/api/games/[id]/recalculate/route.ts` | New force-recalculate API endpoint |
| `src/hooks/use-hasura-game.ts` | Real-time game state hook — recalc triggers added here |
| `src/app/game/[id]/scorer/page.tsx` | Scorer UI — force-recalc button + toast + trigger calls |
| `src/components/scorer/recalc-toast.tsx` | New toast component for recalculation feedback |

## Implementation Order

1. **`recalculateGameTotals()`** in `src/services/game.ts` — foundation for everything else
2. **PATCH handler fix** in events route — uses reverse-old/apply-new pattern from DELETE handler
3. **Recalculate API endpoint** — thin wrapper around `recalculateGameTotals()`
4. **Scorer page triggers** — call recalculate on period change, game finalization, timeout, reconnection
5. **Force-recalc button** — UI in scorer header, calls recalculate endpoint
6. **Toast component** — shows recalculation results (correction or verification)
7. **Tests** — extend existing concurrent test files with new T-series cases

## Testing Strategy

### Test Layers

| Layer | File | What's Tested |
|-------|------|---------------|
| Unit | `src/services/__tests__/game.test.ts` | `recalculateGameTotals()` logic, edge cases |
| Integration | `src/app/api/games/[id]/events/__tests__/route.test.ts` | PATCH recalculation, API permissions |
| Hook | `src/hooks/__tests__/use-hasura-game.concurrent.test.ts` | CAS conflicts, state convergence, reconnection recalc |
| Hook regression | `src/hooks/__tests__/regression.test.ts` | PATCH recalc regression (Bug-3) |
| Load | `tests/load/concurrent-scorers.test.ts` | 3+ scorer scenarios, role enforcement under load |

### Test ID Scheme

Continue existing numbering in `use-hasura-game.concurrent.test.ts`:
- **T099**: PATCH event amendment triggers score recalculation
- **T100**: Full recalculation corrects intentional drift at period change
- **T101**: Full recalculation at game finalization
- **T102**: Reconnection triggers full recalculation
- **T103**: Manual force-recalc button triggers full recalculation
- **T104**: Discrepancy detection logs details and shows toast
- **T105**: Viewer cannot mutate game state during concurrent activity
- **T106**: Co_scorer can score but cannot manage other scorers
- **T107**: Rapid-fire updates (10+/sec) processed without drops
- **T108**: Force-recalc during concurrent updates produces correct result

### Key Test Helpers

```typescript
// Already existing — reuse:
buildCasMock(initialVersion)     // CAS mock with version tracking
setupSubscriptions()             // Captures subscription handlers
pushGameState(version, overrides) // Simulates Hasura subscription data
pushScorers(count)               // Simulates active scorer list

// New helpers to add:
buildDriftedGameState(drift)     // Creates state with intentional score drift
buildRecalcMock()                // Mocks recalculate API response
assertScoreIntegrity(result, expectedEvents) // Verifies totals match event sums
```
