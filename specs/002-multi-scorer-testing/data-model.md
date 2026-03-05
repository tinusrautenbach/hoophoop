# Data Model: Multi-Scorer Concurrent Testing & Fixes

**Feature**: 002-multi-scorer-testing  
**Date**: 2026-03-01

## Existing Entities (Modified)

### games (denormalized totals — target of recalculation)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| homeScore | integer (default 0) | Denormalized — recalculated from gameEvents |
| guestScore | integer (default 0) | Denormalized — recalculated from gameEvents |
| homeFouls | integer (default 0) | Denormalized — recalculated from gameEvents |
| guestFouls | integer (default 0) | Denormalized — recalculated from gameEvents |
| status | enum (scheduled/live/final) | Trigger point: transition to 'final' triggers full recalc |
| currentPeriod | integer (default 1) | Trigger point: period change triggers full recalc |
| totalPeriods | integer (default 4) | Used to determine halftime (currentPeriod = totalPeriods/2) |

**Relationships**: Has many `gameEvents`, has many `gameRosters`, has one `gameStates`

### gameEvents (source of truth for all scores/fouls)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| gameId | uuid (FK → games) | |
| type | enum | score, foul, timeout, sub, block, steal, rebound, turnover, miss, period_start, period_end, clock_start, clock_stop, undo |
| team | enum (home/guest) | Which team the event belongs to |
| player | text | Denormalized player name |
| gameRosterId | uuid (FK → gameRosters) | Links to player roster entry |
| value | integer | Points scored (for type='score') |
| period | integer | Period when event occurred |
| clockAt | integer | Clock time when event occurred |
| createdBy | text | Clerk userId of the scorer who created this event |
| createdAt | timestamp | |

**Validation rules**:
- `type='score'` events MUST have `value > 0` and `team` set
- `type='foul'` events MUST have `team` set
- `gameId` MUST reference an existing, non-deleted game

**Aggregation queries** (used by recalculation):
- Score totals: `SUM(value) WHERE type='score' GROUP BY team`
- Foul totals: `COUNT(*) WHERE type='foul' GROUP BY team`
- Player stats: `SUM/COUNT WHERE (type='score' OR type='foul') GROUP BY name, team`

### gameRosters (player-level denormalized stats)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| gameId | uuid (FK → games) | |
| team | enum (home/guest) | |
| name | text | Denormalized player name |
| number | text | Jersey number |
| points | integer (default 0) | Denormalized — recalculated from gameEvents |
| fouls | integer (default 0) | Denormalized — recalculated from gameEvents |

**Recalculation impact**: Full recalc resets `points` and `fouls` for ALL rosters in the game based on `SUM`/`COUNT` from matching `gameEvents` records.

### gameStates (Hasura real-time sync cache)

| Field | Type | Notes |
|-------|------|-------|
| gameId | uuid (PK, FK → games) | |
| homeScore | integer | Synced from games table |
| guestScore | integer | Synced from games table |
| homeFouls | integer | Synced from games table |
| guestFouls | integer | Synced from games table |
| currentPeriod | integer | |
| status | text | |
| version | integer (default 1) | CAS counter — incremented on every mutation |
| updatedAt | timestamp | |
| updatedBy | text | |

**Sync mechanism**: After any recalculation (incremental or full), call `UPSERT_GAME_STATE_MUTATION` with updated values and `_inc: { version: 1 }`.

### gameScorers (scorer presence and roles)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| gameId | uuid (FK → games) | |
| userId | text | Clerk userId |
| role | enum (owner/co_scorer/viewer) | Determines mutation permissions |
| joinedAt | timestamp | |
| lastActiveAt | timestamp | Presence heartbeat — active if < 35s ago |

**Role enforcement rules** (tested by FR-020, FR-021):
- `viewer`: Can subscribe to game state; CANNOT mutate score, fouls, timer, or events
- `co_scorer`: Can record/edit/delete events and control timer; CANNOT invite/remove scorers or change roles
- `owner`: Full access including scorer management

## New Entities

### RecalculationResult (runtime type — not persisted)

| Field | Type | Notes |
|-------|------|-------|
| corrected | boolean | Whether any discrepancy was found and fixed |
| oldValues | object | `{ homeScore, guestScore, homeFouls, guestFouls }` before recalc |
| newValues | object | `{ homeScore, guestScore, homeFouls, guestFouls }` after recalc |
| rosterChanges | array | `[{ name, team, oldPoints, newPoints, oldFouls, newFouls }]` |
| trigger | string | What initiated the recalc: 'period_change', 'halftime', 'game_final', 'timeout', 'reconnection', 'manual' |
| gameId | string | |
| timestamp | string | ISO 8601 |

**Usage**: Returned by `recalculateGameTotals()`, logged when `corrected=true`, displayed in toast when `corrected=true`.

## State Transitions

### Game Status (recalculation triggers marked with ⟳)

```
scheduled → live → final ⟳
                ↑
                └── Each period change ⟳
                └── Halftime ⟳  
                └── Each timeout ⟳
                └── Scorer reconnection ⟳
                └── Manual force-recalc ⟳
```

### Event Amendment Flow (PATCH fix)

```
1. Old event fetched (snapshot old values)
2. Event fields updated in gameEvents table
3. If type or value changed:
   a. Reverse old impact: subtract old score/foul from games + gameRosters
   b. Apply new impact: add new score/foul to games + gameRosters
4. Sync to Hasura (UPSERT with version increment)
5. Return updated event
```

### Full Recalculation Flow

```
1. Query all gameEvents for gameId (type='score' and type='foul')
2. Aggregate: SUM(value) by team for scores, COUNT by team for fouls
3. Aggregate: SUM/COUNT by player name + team for roster stats
4. Compare aggregated values with current games table values
5. If discrepancy:
   a. Update games table with correct values
   b. Update gameRosters table with correct per-player values
   c. Log discrepancy (old vs new, trigger type, gameId)
   d. Set corrected=true in result
6. Sync to Hasura (UPSERT with version increment)
7. Return RecalculationResult
```
