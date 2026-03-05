/**
 * Stat type validation utilities
 * Feature: 078-configurable-player-stats
 */

import {
  PrimaryStatType,
  DerivedStatType,
  ALL_PRIMARY_STATS,
  type GameStatConfig,
  type ScorerStatFocus,
} from '@/types/stats';

/**
 * Validates if a string is a valid PrimaryStatType
 */
export function isValidPrimaryStatType(value: string): value is PrimaryStatType {
  return Object.values(PrimaryStatType).includes(value as PrimaryStatType);
}

/**
 * Validates if a string is a valid DerivedStatType
 */
export function isValidDerivedStatType(value: string): value is DerivedStatType {
  return Object.values(DerivedStatType).includes(value as DerivedStatType);
}

/**
 * Validates an array of stat types for enabledStats
 * Rules:
 * - Must have at least 1 stat
 * - All stats must be valid PrimaryStatType values
 * - No duplicates allowed
 */
export function validateEnabledStats(stats: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(stats) || stats.length === 0) {
    errors.push('At least one stat must be enabled');
    return { valid: false, errors };
  }

  const invalidStats = stats.filter((stat) => !isValidPrimaryStatType(stat));
  if (invalidStats.length > 0) {
    errors.push(`Invalid stat types: ${invalidStats.join(', ')}`);
  }

  const uniqueStats = new Set(stats);
  if (uniqueStats.size !== stats.length) {
    errors.push('Duplicate stats are not allowed');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates stat focus for a scorer
 * Rules:
 * - Must have 1-3 stats
 * - All stats must be in the game's enabledStats
 * - No duplicates allowed
 */
export function validateScorerFocus(
  focus: string[],
  enabledStats: PrimaryStatType[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(focus) || focus.length === 0 || focus.length > 3) {
    errors.push('Stat focus must contain 1-3 stats');
    return { valid: false, errors };
  }

  const invalidStats = focus.filter((stat) => !isValidPrimaryStatType(stat));
  if (invalidStats.length > 0) {
    errors.push(`Invalid stat types: ${invalidStats.join(', ')}`);
  }

  const enabledSet = new Set(enabledStats);
  const disabledStats = focus.filter((stat) => !enabledSet.has(stat as PrimaryStatType));
  if (disabledStats.length > 0) {
    errors.push(
      `Stats not enabled for this game: ${disabledStats.join(', ')}`
    );
  }

  const uniqueStats = new Set(focus);
  if (uniqueStats.size !== focus.length) {
    errors.push('Duplicate stats are not allowed in focus');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Gets default stat focus based on enabled stats
 * Returns first 3 enabled stats or fewer if less than 3 available
 */
export function getDefaultStatFocus(enabledStats: PrimaryStatType[]): PrimaryStatType[] {
  return enabledStats.slice(0, 3);
}

/**
 * Checks if a stat type is a scoring stat (points-related)
 */
export function isScoringStat(statType: PrimaryStatType): boolean {
  return [
    PrimaryStatType.POINTS_1PT,
    PrimaryStatType.POINTS_2PT,
    PrimaryStatType.POINTS_3PT,
  ].includes(statType);
}

/**
 * Checks if a stat type is a rebound stat
 */
export function isReboundStat(statType: PrimaryStatType): boolean {
  return [PrimaryStatType.REBOUND_OFF, PrimaryStatType.REBOUND_DEF].includes(statType);
}

/**
 * Gets the point value for a scoring stat
 * Returns 0 for non-scoring stats
 */
export function getStatPointValue(statType: PrimaryStatType): number {
  switch (statType) {
    case PrimaryStatType.POINTS_1PT:
      return 1;
    case PrimaryStatType.POINTS_2PT:
      return 2;
    case PrimaryStatType.POINTS_3PT:
      return 3;
    default:
      return 0;
  }
}

/**
 * Filters out derived stats that shouldn't be recorded directly
 * Only primary stats can be recorded; derived stats are calculated
 */
export function filterRecordableStats(stats: string[]): PrimaryStatType[] {
  return stats.filter(isValidPrimaryStatType) as PrimaryStatType[];
}

/**
 * Default enabled stats for new games
 */
export const DEFAULT_ENABLED_STATS: PrimaryStatType[] = [
  PrimaryStatType.POINTS_2PT,
  PrimaryStatType.POINTS_3PT,
  PrimaryStatType.REBOUND_OFF,
  PrimaryStatType.REBOUND_DEF,
  PrimaryStatType.ASSIST,
];

/**
 * Creates a default GameStatConfig for a new game
 */
export function createDefaultGameStatConfig(
  gameId: string,
  userId?: string
): Omit<GameStatConfig, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    gameId,
    enabledStats: [...DEFAULT_ENABLED_STATS],
    displayConfig: {
      statOrder: [...DEFAULT_ENABLED_STATS],
    },
    allowCustomization: true,
    trackFullHistory: false,
    createdBy: userId,
    updatedBy: userId,
  };
}

/**
 * Creates a default ScorerStatFocus
 */
export function createDefaultScorerFocus(
  enabledStats: PrimaryStatType[]
): ScorerStatFocus {
  return {
    statFocus: getDefaultStatFocus(enabledStats),
    showAllStats: false,
  };
}
