# Data Model: Configurable Player Statistics

**Feature**: 078-configurable-player-stats  
**Date**: 2026-03-05  
**Based on**: [spec.md](./spec.md), [research.md](./research.md)

---

## Entity Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   StatType (enum)   │     │  GameStatConfig     │     │   ScorerStatFocus   │
│  (TypeScript only)  │────▶│  (per-game config)  │◀────│  (per-scorer pref)  │
└─────────────────────┘     └──────────┬──────────┘     └─────────────────────┘
                                       │
                                       │ inherits from
                                       ▼
                          ┌─────────────────────────────┐
                          │  SeasonStatConfig (optional)│
                          │  (per-season defaults)      │
                          └──────────────┬──────────────┘
                                         │ inherits from
                                         ▼
                            ┌─────────────────────────┐
                            │ CommunityStatConfig     │
                            │ (community defaults)    │
                            └─────────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   PlayerStatEvent   │────▶│   PlayerGameStats   │◀────│    GameEvent        │
│  (raw event data)   │     │  (aggregated view)  │     │  (existing table)   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Entities

### 1. StatType (TypeScript Enum)

Enumeration of all supported statistics. Not stored in database - used for type safety.

```typescript
// Primary Stats (recorded by scorers)
enum PrimaryStatType {
  // Points
  POINTS_1PT = 'points_1pt',    // Free throw
  POINTS_2PT = 'points_2pt',    // Field goal
  POINTS_3PT = 'points_3pt',    // Three pointer
  
  // Rebounds
  REBOUND_OFF = 'rebound_off',  // Offensive rebound
  REBOUND_DEF = 'rebound_def',  // Defensive rebound
  
  // Defense/Playmaking
  ASSIST = 'assist',
  STEAL = 'steal',
  BLOCK = 'block',
  TURNOVER = 'turnover',
  FOUL = 'foul',
}

// Derived Stats (calculated automatically)
enum DerivedStatType {
  POINTS_TOTAL = 'points_total',    // Sum of all point types
  REBOUND_TOTAL = 'rebound_total',  // OFF + DEF
}

type StatType = PrimaryStatType | DerivedStatType;
```

**Validation Rules**:
- Primary stats can be enabled/disabled per game
- Derived stats are automatically shown if their components are enabled
- Maximum 12 primary stats (current count is 10)

---

### 2. GameStatConfig

Per-game configuration of which statistics are tracked.

**Table**: `game_stat_configs` (new table)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | PK | Unique identifier |
| `gameId` | uuid | FK | Reference to games table |
| `seasonId` | uuid | FK | Reference to seasons (for inheritance tracking) |
| `communityId` | uuid | FK | Reference to communities (for inheritance tracking) |
| `enabledStats` | jsonb | Y | Array of enabled PrimaryStatType values |
| `displayConfig` | jsonb | N | Display preferences (order, grouping) |
| `allowCustomization` | boolean | Y | Whether scorers can customize focus |
| `trackFullHistory` | boolean | N | Store full audit trail for this game |
| `createdAt` | timestamp | Y | Creation time |
| `updatedAt` | timestamp | Y | Last update time |
| `createdBy` | uuid | FK | User who created config |
| `updatedBy` | uuid | FK | User who last updated |

**JSON Schema for `enabledStats`**:
```json
{
  "type": "array",
  "items": {
    "type": "string",
    "enum": ["points_1pt", "points_2pt", "points_3pt", "rebound_off", "rebound_def", "assist", "steal", "block", "turnover", "foul"]
  }
}
```

**JSON Schema for `displayConfig`**:
```json
{
  "type": "object",
  "properties": {
    "statOrder": {
      "type": "array",
      "items": { "type": "string" }
    },
    "groupings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "stats": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

**State Transitions**:
```
[Pre-Game] ──enable/disable stats──▶ [In Progress] ──game ends──▶ [Completed]
    │
    └── Can modify freely          └── Warning if disabling stats with data
```

---

### 3. ScorerStatFocus

Per-scorer preference for which stats appear as quick-access buttons.

**Table Extension**: `game_scorers` (add columns to existing)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `statFocus` | jsonb | N | Array of 1-3 PrimaryStatType values |
| `showAllStats` | boolean | N | Whether to show "More Stats" expanded |
| `focusUpdatedAt` | timestamp | N | When focus was last changed |

**JSON Schema for `statFocus`**:
```json
{
  "type": "array",
  "minItems": 1,
  "maxItems": 3,
  "items": {
    "type": "string",
    "enum": [/* PrimaryStatType values */]
  }
}
```

**Default Value Logic**:
1. If `game_scorers.statFocus` exists → use it
2. Else if user has global preference → use that
3. Else → first 3 enabled stats from GameStatConfig

---

### 4. PlayerStatEvent

Raw event data for a single statistic recorded. Extends existing game_events table.

**Table**: `game_events` (extend existing schema)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | PK | Unique identifier |
| `gameId` | uuid | FK | Reference to games |
| `playerId` | uuid | FK | Reference to roster entry |
| `team` | enum | Y | 'home' or 'guest' |
| `type` | string | Y | Event type: 'stat' |
| `statType` | string | Y | PrimaryStatType value |
| `value` | integer | Y | Always 1 for most stats, points value for POINTS_* |
| `period` | integer | Y | Game period |
| `clockAt` | integer | Y | Seconds remaining in period |
| `metadata` | jsonb | N | Additional context |
| `createdBy` | uuid | FK | Scorer who recorded |
| `createdAt` | timestamp | Y | When recorded |
| `modifiedBy` | uuid | FK | Who last edited (nullable) |
| `modifiedAt` | timestamp | N | When last edited |
| `version` | integer | Y | Version number (starts at 1) |
| `previousVersion` | jsonb | N | Previous event data (if trackFullHistory) |

**Validation Rules**:
- `statType` must be in GameStatConfig.enabledStats for this game
- `value` must be positive integer
- `playerId` must be active roster member for this game
- `version` increments on each edit

---

### 5. PlayerGameStats (Derived View)

Aggregated statistics per player per game. Not stored - calculated from events.

**TypeScript Interface**:

```typescript
interface PlayerGameStats {
  // Identity
  playerId: string;
  gameId: string;
  team: 'home' | 'guest';
  
  // Points
  points1pt: number;
  points2pt: number;
  points3pt: number;
  pointsTotal: number;  // Derived: sum of above
  
  // Rebounds
  reboundsOff: number;
  reboundsDef: number;
  reboundsTotal: number;  // Derived: off + def
  
  // Other stats
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  
  // Efficiency (if time tracking enabled)
  minutesPlayed?: number;
  
  // Metadata
  lastUpdated: Date;
}
```

**Aggregation Logic**:
```typescript
function aggregatePlayerStats(events: PlayerStatEvent[]): PlayerGameStats {
  return events.reduce((stats, event) => {
    switch (event.statType) {
      case 'points_1pt': stats.points1pt += event.value; break;
      case 'points_2pt': stats.points2pt += event.value; break;
      case 'points_3pt': stats.points3pt += event.value; break;
      case 'rebound_off': stats.reboundsOff += 1; break;
      case 'rebound_def': stats.reboundsDef += 1; break;
      // ... etc
    }
    // Calculate derived stats
    stats.pointsTotal = stats.points1pt + stats.points2pt + stats.points3pt;
    stats.reboundsTotal = stats.reboundsOff + stats.reboundsDef;
    return stats;
  }, initialStats);
}
```

---

## Relationships

```
GameStatConfig ||--o{ Game : configures
GameStatConfig }o--|| Season : inherits_defaults
GameStatConfig }o--|| Community : inherits_defaults

GameScorer }|--|| Game : scores_for
GameScorer }|--|| User : is_scorer
GameScorer ||--o| ScorerStatFocus : has_focus

PlayerStatEvent }|--|| Game : belongs_to
PlayerStatEvent }|--|| RosterEntry : targets_player
PlayerStatEvent }|--|| User : recorded_by

PlayerGameStats ||--o{ PlayerStatEvent : derived_from
```

---

## Indexes

**game_stat_configs**:
- `PRIMARY KEY (id)`
- `UNIQUE (gameId)`
- `INDEX (seasonId)`
- `INDEX (communityId)`

**game_events** (existing, new indexes):
- `INDEX (gameId, statType)` - For stat aggregation queries
- `INDEX (gameId, playerId)` - For player stat queries
- `INDEX (modifiedAt)` - For audit trail queries

**game_scorers** (existing, new index):
- No new indexes needed (lookup by gameId + userId already exists)

---

## Migration Strategy

### Step 1: Create game_stat_configs table
```sql
CREATE TABLE game_stat_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  community_id UUID REFERENCES communities(id),
  enabled_stats JSONB NOT NULL DEFAULT '["points_2pt", "points_3pt", "rebound_total", "assist"]',
  display_config JSONB DEFAULT '{}',
  allow_customization BOOLEAN NOT NULL DEFAULT true,
  track_full_history BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (game_id)
);
```

### Step 2: Extend game_events table
```sql
ALTER TABLE game_events 
  ADD COLUMN stat_type VARCHAR(50),
  ADD COLUMN modified_by UUID REFERENCES users(id),
  ADD COLUMN modified_at TIMESTAMP,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN previous_version JSONB;

CREATE INDEX idx_game_events_stat ON game_events(game_id, stat_type);
```

### Step 3: Extend game_scorers table
```sql
ALTER TABLE game_scorers
  ADD COLUMN stat_focus JSONB,
  ADD COLUMN show_all_stats BOOLEAN DEFAULT false,
  ADD COLUMN focus_updated_at TIMESTAMP;
```

### Step 4: Backfill existing games
```sql
-- Create default configs for all existing games
INSERT INTO game_stat_configs (game_id, season_id, community_id, enabled_stats, created_by)
SELECT 
  g.id,
  g.season_id,
  g.community_id,
  '["points_2pt", "points_3pt", "rebound_total", "assist"]'::jsonb,
  g.owner_id
FROM games g
LEFT JOIN game_stat_configs gsc ON g.id = gsc.game_id
WHERE gsc.id IS NULL;
```

---

## Validation Rules

### GameStatConfig
- At least 1 stat must be enabled
- All stat types in enabledStats must be valid PrimaryStatType values
- gameId must reference existing game
- Only game owner or community admin can modify

### ScorerStatFocus
- Must contain 1-3 stat types
- All stat types must be in GameStatConfig.enabledStats
- Scorer must be active game_scorer for this game

### PlayerStatEvent
- statType must be enabled for this game
- playerId must be active roster member
- period must be valid for game state
- clockAt must be non-negative

---

## TypeScript Types

```typescript
// types/stats.ts

export type PrimaryStatType = 
  | 'points_1pt' 
  | 'points_2pt' 
  | 'points_3pt'
  | 'rebound_off'
  | 'rebound_def'
  | 'assist'
  | 'steal'
  | 'block'
  | 'turnover'
  | 'foul';

export type DerivedStatType = 
  | 'points_total' 
  | 'rebound_total';

export type StatType = PrimaryStatType | DerivedStatType;

export interface GameStatConfig {
  id: string;
  gameId: string;
  seasonId?: string;
  communityId?: string;
  enabledStats: PrimaryStatType[];
  displayConfig?: {
    statOrder?: StatType[];
    groupings?: { name: string; stats: StatType[] }[];
  };
  allowCustomization: boolean;
  trackFullHistory?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface ScorerStatFocus {
  statFocus: PrimaryStatType[];
  showAllStats?: boolean;
  focusUpdatedAt?: Date;
}

export interface PlayerStatEvent {
  id: string;
  gameId: string;
  playerId: string;
  team: 'home' | 'guest';
  type: 'stat';
  statType: PrimaryStatType;
  value: number;
  period: number;
  clockAt: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
  version: number;
  previousVersion?: unknown;
}

export interface PlayerGameStats {
  playerId: string;
  gameId: string;
  team: 'home' | 'guest';
  
  // Primary stats (from events)
  points1pt: number;
  points2pt: number;
  points3pt: number;
  reboundsOff: number;
  reboundsDef: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  
  // Derived stats (calculated)
  pointsTotal: number;
  reboundsTotal: number;
  
  // Optional
  minutesPlayed?: number;
  
  lastUpdated: Date;
}
```
