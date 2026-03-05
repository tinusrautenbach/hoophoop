/**
 * Stat type definitions for configurable player statistics
 * Feature: 078-configurable-player-stats
 */

// Primary Stats (recorded by scorers)
export enum PrimaryStatType {
  // Points
  POINTS_1PT = 'points_1pt',
  POINTS_2PT = 'points_2pt',
  POINTS_3PT = 'points_3pt',

  // Rebounds
  REBOUND_OFF = 'rebound_off',
  REBOUND_DEF = 'rebound_def',

  // Defense/Playmaking
  ASSIST = 'assist',
  STEAL = 'steal',
  BLOCK = 'block',
  TURNOVER = 'turnover',
  FOUL = 'foul',
}

// Derived Stats (calculated automatically)
export enum DerivedStatType {
  POINTS_TOTAL = 'points_total',
  REBOUND_TOTAL = 'rebound_total',
}

export type StatType = PrimaryStatType | DerivedStatType;

// All primary stat types as array for iteration
export const ALL_PRIMARY_STATS: PrimaryStatType[] = [
  PrimaryStatType.POINTS_1PT,
  PrimaryStatType.POINTS_2PT,
  PrimaryStatType.POINTS_3PT,
  PrimaryStatType.REBOUND_OFF,
  PrimaryStatType.REBOUND_DEF,
  PrimaryStatType.ASSIST,
  PrimaryStatType.STEAL,
  PrimaryStatType.BLOCK,
  PrimaryStatType.TURNOVER,
  PrimaryStatType.FOUL,
];

// Display names for stats
export const STAT_DISPLAY_NAMES: Record<StatType, string> = {
  [PrimaryStatType.POINTS_1PT]: 'FT',
  [PrimaryStatType.POINTS_2PT]: '2PT',
  [PrimaryStatType.POINTS_3PT]: '3PT',
  [PrimaryStatType.REBOUND_OFF]: 'OREB',
  [PrimaryStatType.REBOUND_DEF]: 'DREB',
  [PrimaryStatType.ASSIST]: 'AST',
  [PrimaryStatType.STEAL]: 'STL',
  [PrimaryStatType.BLOCK]: 'BLK',
  [PrimaryStatType.TURNOVER]: 'TO',
  [PrimaryStatType.FOUL]: 'PF',
  [DerivedStatType.POINTS_TOTAL]: 'PTS',
  [DerivedStatType.REBOUND_TOTAL]: 'REB',
};

// Full display names for stats
export const STAT_FULL_NAMES: Record<StatType, string> = {
  [PrimaryStatType.POINTS_1PT]: 'Free Throw',
  [PrimaryStatType.POINTS_2PT]: '2-Point Field Goal',
  [PrimaryStatType.POINTS_3PT]: '3-Point Field Goal',
  [PrimaryStatType.REBOUND_OFF]: 'Offensive Rebound',
  [PrimaryStatType.REBOUND_DEF]: 'Defensive Rebound',
  [PrimaryStatType.ASSIST]: 'Assist',
  [PrimaryStatType.STEAL]: 'Steal',
  [PrimaryStatType.BLOCK]: 'Block',
  [PrimaryStatType.TURNOVER]: 'Turnover',
  [PrimaryStatType.FOUL]: 'Personal Foul',
  [DerivedStatType.POINTS_TOTAL]: 'Total Points',
  [DerivedStatType.REBOUND_TOTAL]: 'Total Rebounds',
};

// Stat categories for grouping in UI
export const STAT_CATEGORIES = {
  SCORING: [
    PrimaryStatType.POINTS_1PT,
    PrimaryStatType.POINTS_2PT,
    PrimaryStatType.POINTS_3PT,
  ],
  REBOUNDING: [
    PrimaryStatType.REBOUND_OFF,
    PrimaryStatType.REBOUND_DEF,
  ],
  DEFENSE: [
    PrimaryStatType.STEAL,
    PrimaryStatType.BLOCK,
  ],
  PLAYMAKING: [
    PrimaryStatType.ASSIST,
  ],
  OTHER: [
    PrimaryStatType.TURNOVER,
    PrimaryStatType.FOUL,
  ],
} as const;

// Game stat configuration
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

// Scorer stat focus preferences
export interface ScorerStatFocus {
  statFocus: PrimaryStatType[];
  showAllStats?: boolean;
  focusUpdatedAt?: Date;
}

// Player stat event (recorded in game_events)
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

// Aggregated player game stats
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

// Inheritance chain for stat configuration
export interface StatConfigInheritance {
  game: {
    enabledStats: PrimaryStatType[];
    source: 'game_override';
  };
  season?: {
    id: string;
    name: string;
    enabledStats: PrimaryStatType[];
    source: 'season_default';
  };
  community?: {
    id: string;
    name: string;
    enabledStats: PrimaryStatType[];
    source: 'community_default';
  };
}

// API request/response types
export interface UpdateStatConfigRequest {
  enabledStats: PrimaryStatType[];
  displayConfig?: GameStatConfig['displayConfig'];
  allowCustomization?: boolean;
  trackFullHistory?: boolean;
}

export interface UpdateScorerFocusRequest {
  statFocus: PrimaryStatType[];
  showAllStats?: boolean;
}

export interface ScorerFocusWithUser {
  userId: string;
  displayName: string;
  statFocus: PrimaryStatType[];
  showAllStats: boolean;
}
