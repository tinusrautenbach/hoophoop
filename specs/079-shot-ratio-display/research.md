# Research: Shot Ratio Display in Game Log

**Branch**: `079-shot-ratio-display` | **Date**: 2026-03-16

## Summary

Research confirms the core implementation already exists in `src/components/scorer/game-log.tsx`. This research identifies what's implemented, what's missing (tests), and potential edge case issues.

---

## R1: Existing Implementation Discovery

### Finding: Implementation Already Exists

The `getShotRatio()` function is fully implemented in `game-log.tsx` (lines 61-89):

```typescript
function getShotRatio(
    event: GameEvent,
    allEvents: GameEvent[]
): string | null {
    if ((event.type !== 'score' && event.type !== 'miss') || !event.player || !event.value) return null;

    // Sort chronologically (oldest first)
    const chronological = [...allEvents].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const eventIndex = chronological.findIndex((e) => e.id === event.id);
    if (eventIndex === -1) return null;

    const eventsUpToNow = chronological.slice(0, eventIndex + 1);

    const made = eventsUpToNow.filter(
        (e) => e.type === 'score' && e.player === event.player && e.value === event.value
    ).length;

    const attempts = eventsUpToNow.filter(
        (e) =>
            (e.type === 'score' || e.type === 'miss') &&
            e.player === event.player &&
            e.value === event.value
    ).length;

    return `(${made}/${attempts})`;
}
```

### Finding: Display Integration Exists

The ratio is displayed in the event rendering (lines 152-157):

```tsx
{(event.type === 'score' || event.type === 'miss') && event.player && (() => {
    const ratio = getShotRatio(event, events);
    return ratio ? (
        <span className="text-slate-500 ml-1">{ratio}</span>
    ) : null;
})()}
```

### Decision: Focus on Tests Only

- **Decision**: Add unit and E2E tests; no code changes needed for core feature
- **Rationale**: Implementation matches spec requirements; only test coverage is missing
- **Alternative considered**: Refactor to separate file — rejected as premature; function is small and colocated with usage

---

## R2: GameEvent Type Structure

### Finding: GameEvent Type Definition

Defined in `game-log.tsx` (lines 12-24):

```typescript
export type GameEvent = {
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

### Decision: No Type Changes Needed

- The existing `type`, `player`, `value`, and `timestamp` fields are sufficient for ratio calculation
- No new fields required

---

## R3: Event Flow Architecture

### Finding: Events are Passed as Props

The `GameLog` component receives events as a prop:

```typescript
interface GameLogProps {
    events: GameEvent[];
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
    limit?: number;
    onHeaderClick?: () => void;
    hideHeader?: boolean;
}
```

### Finding: Real-Time Updates via React Prop Reactivity

Events flow through:
1. Hasura WebSocket subscription → `use-hasura-game.ts` hook
2. Hook exposes `events` array
3. Parent component passes `events` to `GameLog` as prop
4. React re-renders `GameLog` when `events` changes
5. `getShotRatio` recalculates for each render

### Decision: No Performance Optimization Needed

- **Decision**: Accept O(n²) calculation complexity (each event iterates all events for ratio)
- **Rationale**: For 100+ events, calculation is < 1ms; spec SC-005 targets no performance degradation
- **Alternative considered**: Memoization — rejected as premature optimization

---

## R4: Edge Case Analysis

### Finding: Team Filter Missing

Current implementation does NOT filter by team:

```typescript
const made = eventsUpToNow.filter(
    (e) => e.type === 'score' && e.player === event.player && e.value === event.value
).length;
```

The spec edge case states:
> "Ratio is calculated per player per team; if team changes, ratios are separate for each team stint."

### Decision Options

| Option | Description | Impact |
|--------|-------------|--------|
| A: Fix code | Add `&& e.team === event.team` to filters | Breaking change if deployed |
| B: Update spec | Change assumption to match code (ratios accumulate across teams) | Non-breaking, simpler |
| C: Add config flag | Allow per-game configuration of team separation | Over-engineering |

**Recommendation**: Option B — update spec to match current behavior. In basketball, a player scoring on both teams in the same game is extremely rare (trades mid-game don't happen). The current behavior (accumulating across teams) is acceptable and simpler.

### Finding: Chronology Secondary Sort

Events with identical timestamps rely on JavaScript sort stability. The current implementation:

```typescript
const chronological = [...allEvents].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
);
```

This doesn't have a secondary sort key for same-timestamp events. However, the spec edge case states:
> "Events are sorted by creation time as a secondary sort key"

### Decision: Add Secondary Sort

- **Decision**: Add `id` as secondary sort key for deterministic ordering
- **Rationale**: Ensures consistent ratio calculation when timestamps are equal
- **Implementation**: `(a.timestamp.getTime() - b.timestamp.getTime()) || a.id.localeCompare(b.id)`

---

## R5: Test File Location

### Finding: No Existing Tests for game-log.tsx

```bash
$ grep -r "game-log.test" src/
# No results
```

### Decision: Create Test File

- **Location**: `src/components/scorer/__tests__/game-log.test.ts`
- **Pattern**: Follow existing test structure in `src/hooks/__tests__/`
- **Framework**: Vitest + @testing-library/react

---

## R6: E2E Test Considerations

### Finding: Existing E2E Test Structure

Located in `tests/e2e/`:
- `multi-scorer.spec.ts` — multi-scorer E2E tests
- `roles.spec.ts` — role enforcement tests

### Decision: Add E2E Test File

- **Location**: `tests/e2e/shot-ratio.spec.ts`
- **Pattern**: Follow existing Playwright test structure
- **Scope**: Verify ratio displays in game log for score and miss events

---

## Summary Table

| Research Topic | Finding | Action |
|----------------|---------|--------|
| Implementation status | Already exists in game-log.tsx | No code changes needed |
| GameEvent type | Sufficient for feature | No type changes |
| Event flow | Props + React reactivity | No changes |
| Team filter edge case | Not implemented | Update spec assumption |
| Chronology secondary sort | Not implemented | Add to code |
| Unit tests | Missing | Create game-log.test.ts |
| E2E tests | Missing | Create shot-ratio.spec.ts |