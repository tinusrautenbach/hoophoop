# Research: Configurable Player Statistics

**Feature**: 078-configurable-player-stats  
**Date**: 2026-03-05  
**Purpose**: Resolve design decisions and document technical approach

---

## Research Areas

### 1. Stat Configuration Hierarchy

**Question**: How should stat configuration inheritance work across community/season/game levels?

**Investigation**:
- Existing codebase has communities, seasons, and games tables
- Games already have a `mode` field (simple/advanced) that affects behavior
- Season configuration would be natural extension of existing hierarchy

**Decision**: Three-level hierarchy with inheritance:
1. **Community defaults** - baseline stats for all games in community
2. **Season override** - can customize for specific season (e.g., playoffs track more stats)
3. **Game override** - final customization for individual games

**Implementation approach**:
```typescript
// Resolution order: Game → Season → Community → System defaults
// All stored in game_stat_configs table with inheritance chain
```

---

### 2. Real-time Stat Aggregation Strategy

**Question**: How to aggregate stats in real-time across multiple scorers without performance issues?

**Investigation**:
- Existing `useHasuraGame` hook already subscribes to game_events
- Score recalculation already works via server-side reduction
- Hasura subscriptions provide <500ms propagation

**Decision**: Client-side aggregation from event stream
- Subscribe to `game_events` via Hasura
- Maintain local stat accumulator that rebuilds on event changes
- Use existing event metadata pattern with `type` and `metadata` fields

**Rationale**:
- Consistent with existing score recalculation pattern
- No additional server load
- Immediate updates without API calls
- Simple to implement and test

---

### 3. Stat Types Schema Design

**Question**: How to represent stat types in the database and TypeScript?

**Investigation**:
- Existing event system uses string `type` field in game_events
- Need to distinguish between primary (recorded) and derived (calculated) stats
- Must support extensibility for future stat types

**Decision**: Enum-based approach with type safety

**Primary Stats** (recorded by scorers):
- `POINTS_1PT`, `POINTS_2PT`, `POINTS_3PT`
- `REBOUND_OFF`, `REBOUND_DEF`
- `ASSIST`, `STEAL`, `BLOCK`, `TURNOVER`, `FOUL`

**Derived Stats** (calculated):
- `POINTS_TOTAL` = sum of all point types
- `REBOUND_TOTAL` = OFF + DEF

**Database Schema**:
```typescript
// Stored as JSONB in game_stat_configs
interface StatConfig {
  statType: string;
  enabled: boolean;
  displayOrder: number;
  quickAccess: boolean; // Can be in primary focus
}
```

---

### 4. Scorer Focus Persistence

**Question**: Where and how to store per-scorer stat focus preferences?

**Investigation**:
- Existing `game_scorers` table tracks who is scoring each game
- User preferences typically stored per-user
- Need both global default and per-game override

**Decision**: Store in `game_scorers` table with user profile fallback

**Schema**:
```typescript
// game_scorers table extension
scorerStatFocus: string[] // Array of stat type IDs (1-3 items)

// User profile (for global default)
// Store in user metadata via Clerk or separate user_preferences table
defaultStatFocus: string[]
```

**Behavior**:
1. New game: Use global default from user profile
2. Join existing game: Check if per-game focus exists, else use global default
3. Change focus: Save to `game_scorers.scorerStatFocus` for this game

---

### 5. Audit Trail Implementation

**Question**: How to track full edit history for stat events?

**Investigation**:
- Existing game_events table already has `createdBy`, `createdAt`
- Need to add modification tracking
- Version history could become large

**Decision**: Extend existing event table with audit fields

**Schema Changes**:
```typescript
// Add to game_events table
modifiedBy: string | null
modifiedAt: Date | null
version: number // Increment on each edit
previousVersion: string | null // Reference to previous version JSON (optional)
```

**Tradeoffs**:
- **Option A**: Store full version history (heavy, but complete)
- **Option B**: Store only current + last version (lightweight, but limited history)
- **Option C**: Store only modification metadata (who/when, not what changed)

**Selected**: Option B with optional full history
- By default, store current version + metadata
- If `trackFullHistory` flag set on game, store previous versions in separate audit table

---

### 6. Mobile UI Layout

**Question**: How to display 6+ stat buttons on mobile without clutter?

**Investigation**:
- Constitution requires mobile-first, 320px minimum
- Touch targets must be ≥48×48px
- Existing scorer interface already has this constraint

**Decision**: Collapsible stat interface

**Layout**:
```
[Primary Stats - 1-3 buttons visible] [More ▼]
[Scoreboard area]
[Player selection]

When "More" tapped:
- Slide up modal or expand section
- Show all enabled stats in grid
- Group related stats (Points, Rebounds, Defense, etc.)
```

**Button sizing**:
- Primary focus: Large buttons (60×60px minimum)
- Secondary stats: Standard buttons (48×48px minimum)
- Grid layout: 3-4 columns depending on screen width

---

## Design Decisions Summary

| Decision | Approach | Rationale |
|----------|----------|-----------|
| Config inheritance | Community → Season → Game | Matches existing hierarchy |
| Aggregation | Client-side from event stream | Consistent with existing patterns |
| Stat types | Enum with primary/derived distinction | Type safety and clarity |
| Focus persistence | Global default + per-game override | Flexibility for different game types |
| Audit trail | Current + last version + metadata | Balance of utility and performance |
| Mobile layout | Collapsible with focus selector | Meets mobile-first requirement |

---

## Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Event stream performance with many stats | Low | Medium | Test with 1000+ events; pagination if needed |
| Conflicts when scorers edit same event | Low | Low | Optimistic locking with version field |
| Mobile UI too crowded with many stats | Medium | Medium | Progressive disclosure via "More" button |
| Stat config sync lag | Low | Low | Hasura subscriptions already <500ms |

---

## Open Questions (None Critical)

1. **Should seasons inherit from communities automatically?**
   - Assumption: Yes, but can be overridden
   - Can be decided during implementation

2. **Maximum number of stats to track?**
   - Assumption: 10-12 primary stats
   - Current design supports unlimited

3. **Should derived stats be configurable (show/hide)?**
   - Assumption: Always show derived stats if primary components enabled
   - Simpler than making everything configurable

---

## Research Complete

All critical design decisions resolved. Ready to proceed to Phase 1 (Data Model & Contracts).
