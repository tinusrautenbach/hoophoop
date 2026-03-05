/**
 * Derived stat calculations
 * Feature: 078-configurable-player-stats
 */

import {
  PrimaryStatType,
  DerivedStatType,
  type PlayerGameStats,
  STAT_DISPLAY_NAMES,
} from '@/types/stats';

/**
 * Calculates total points from individual point stats
 */
export function calculatePointsTotal(
  points1pt: number,
  points2pt: number,
  points3pt: number
): number {
  return points1pt * 1 + points2pt * 2 + points3pt * 3;
}

/**
 * Calculates total rebounds from offensive and defensive
 */
export function calculateReboundsTotal(
  reboundsOff: number,
  reboundsDef: number
): number {
  return reboundsOff + reboundsDef;
}

/**
 * Calculates all derived stats for a player game stats object
 */
export function calculateDerivedStats(
  stats: Omit<PlayerGameStats, 'pointsTotal' | 'reboundsTotal'>
): Pick<PlayerGameStats, 'pointsTotal' | 'reboundsTotal'> {
  return {
    pointsTotal: calculatePointsTotal(
      stats.points1pt,
      stats.points2pt,
      stats.points3pt
    ),
    reboundsTotal: calculateReboundsTotal(
      stats.reboundsOff,
      stats.reboundsDef
    ),
  };
}

/**
 * Gets all derived stat types that should be calculated
 * based on which primary stats are enabled
 */
export function getDerivedStatsToCalculate(
  enabledStats: PrimaryStatType[]
): DerivedStatType[] {
  const derived: DerivedStatType[] = [];
  const enabledSet = new Set(enabledStats);

  // Check if any point stats are enabled
  const hasPointStats = [
    PrimaryStatType.POINTS_1PT,
    PrimaryStatType.POINTS_2PT,
    PrimaryStatType.POINTS_3PT,
  ].some((stat) => enabledSet.has(stat));

  if (hasPointStats) {
    derived.push(DerivedStatType.POINTS_TOTAL);
  }

  // Check if any rebound stats are enabled
  const hasReboundStats = [
    PrimaryStatType.REBOUND_OFF,
    PrimaryStatType.REBOUND_DEF,
  ].some((stat) => enabledSet.has(stat));

  if (hasReboundStats) {
    derived.push(DerivedStatType.REBOUND_TOTAL);
  }

  return derived;
}

/**
 * Determines if a derived stat should be displayed
 * based on whether its component stats are enabled
 */
export function shouldShowDerivedStat(
  derivedStat: DerivedStatType,
  enabledStats: PrimaryStatType[]
): boolean {
  const enabledSet = new Set(enabledStats);

  switch (derivedStat) {
    case DerivedStatType.POINTS_TOTAL:
      return [
        PrimaryStatType.POINTS_1PT,
        PrimaryStatType.POINTS_2PT,
        PrimaryStatType.POINTS_3PT,
      ].some((stat) => enabledSet.has(stat));

    case DerivedStatType.REBOUND_TOTAL:
      return [PrimaryStatType.REBOUND_OFF, PrimaryStatType.REBOUND_DEF].some(
        (stat) => enabledSet.has(stat)
      );

    default:
      return false;
  }
}

/**
 * Gets the component stats that make up a derived stat
 */
export function getDerivedStatComponents(
  derivedStat: DerivedStatType
): PrimaryStatType[] {
  switch (derivedStat) {
    case DerivedStatType.POINTS_TOTAL:
      return [
        PrimaryStatType.POINTS_1PT,
        PrimaryStatType.POINTS_2PT,
        PrimaryStatType.POINTS_3PT,
      ];
    case DerivedStatType.REBOUND_TOTAL:
      return [PrimaryStatType.REBOUND_OFF, PrimaryStatType.REBOUND_DEF];
    default:
      return [];
  }
}

/**
 * Formats a stat value for display
 * Returns empty string for zero values (cleaner UI)
 */
export function formatStatValue(value: number): string {
  if (value === 0) return '';
  return value.toString();
}

/**
 * Gets the display abbreviation for a stat type
 */
export function getStatAbbreviation(statType: PrimaryStatType | DerivedStatType): string {
  return STAT_DISPLAY_NAMES[statType] || statType;
}
