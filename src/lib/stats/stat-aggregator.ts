/**
 * Stat aggregation logic for real-time stats calculation
 * Feature: 078-configurable-player-stats
 */

import {
  PrimaryStatType,
  DerivedStatType,
  type PlayerStatEvent,
  type PlayerGameStats,
} from '@/types/stats';
import { calculateDerivedStats } from './stat-calculator';

/**
 * Initial empty stats object for a player
 */
export function createInitialPlayerStats(
  playerId: string,
  gameId: string,
  team: 'home' | 'guest'
): PlayerGameStats {
  const now = new Date();
  return {
    playerId,
    gameId,
    team,
    points1pt: 0,
    points2pt: 0,
    points3pt: 0,
    reboundsOff: 0,
    reboundsDef: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    pointsTotal: 0,
    reboundsTotal: 0,
    lastUpdated: now,
  };
}

/**
 * Aggregates a single stat event into player stats
 * Returns updated stats with derived values recalculated
 */
export function aggregateStatEvent(
  currentStats: PlayerGameStats,
  event: PlayerStatEvent
): PlayerGameStats {
  const updated = { ...currentStats };

  switch (event.statType) {
    case PrimaryStatType.POINTS_1PT:
      updated.points1pt += event.value;
      break;
    case PrimaryStatType.POINTS_2PT:
      updated.points2pt += event.value;
      break;
    case PrimaryStatType.POINTS_3PT:
      updated.points3pt += event.value;
      break;
    case PrimaryStatType.REBOUND_OFF:
      updated.reboundsOff += event.value;
      break;
    case PrimaryStatType.REBOUND_DEF:
      updated.reboundsDef += event.value;
      break;
    case PrimaryStatType.ASSIST:
      updated.assists += event.value;
      break;
    case PrimaryStatType.STEAL:
      updated.steals += event.value;
      break;
    case PrimaryStatType.BLOCK:
      updated.blocks += event.value;
      break;
    case PrimaryStatType.TURNOVER:
      updated.turnovers += event.value;
      break;
    case PrimaryStatType.FOUL:
      updated.fouls += event.value;
      break;
  }

  // Recalculate derived stats
  const derived = calculateDerivedStats(updated);
  updated.pointsTotal = derived.pointsTotal;
  updated.reboundsTotal = derived.reboundsTotal;
  updated.lastUpdated = new Date();

  return updated;
}

/**
 * Reverses a stat event (for undo/edit operations)
 * Returns updated stats with derived values recalculated
 */
export function reverseStatEvent(
  currentStats: PlayerGameStats,
  event: PlayerStatEvent
): PlayerGameStats {
  const updated = { ...currentStats };

  switch (event.statType) {
    case PrimaryStatType.POINTS_1PT:
      updated.points1pt = Math.max(0, updated.points1pt - event.value);
      break;
    case PrimaryStatType.POINTS_2PT:
      updated.points2pt = Math.max(0, updated.points2pt - event.value);
      break;
    case PrimaryStatType.POINTS_3PT:
      updated.points3pt = Math.max(0, updated.points3pt - event.value);
      break;
    case PrimaryStatType.REBOUND_OFF:
      updated.reboundsOff = Math.max(0, updated.reboundsOff - event.value);
      break;
    case PrimaryStatType.REBOUND_DEF:
      updated.reboundsDef = Math.max(0, updated.reboundsDef - event.value);
      break;
    case PrimaryStatType.ASSIST:
      updated.assists = Math.max(0, updated.assists - event.value);
      break;
    case PrimaryStatType.STEAL:
      updated.steals = Math.max(0, updated.steals - event.value);
      break;
    case PrimaryStatType.BLOCK:
      updated.blocks = Math.max(0, updated.blocks - event.value);
      break;
    case PrimaryStatType.TURNOVER:
      updated.turnovers = Math.max(0, updated.turnovers - event.value);
      break;
    case PrimaryStatType.FOUL:
      updated.fouls = Math.max(0, updated.fouls - event.value);
      break;
  }

  // Recalculate derived stats
  const derived = calculateDerivedStats(updated);
  updated.pointsTotal = derived.pointsTotal;
  updated.reboundsTotal = derived.reboundsTotal;
  updated.lastUpdated = new Date();

  return updated;
}

/**
 * Aggregates all stat events for a game into player stats
 * Returns a map of playerId -> PlayerGameStats
 */
export function aggregateAllPlayerStats(
  events: PlayerStatEvent[],
  gameId: string
): Map<string, PlayerGameStats> {
  const playerStats = new Map<string, PlayerGameStats>();

  for (const event of events) {
    if (event.type !== 'stat' || !event.statType) continue;

    let stats = playerStats.get(event.playerId);
    if (!stats) {
      stats = createInitialPlayerStats(event.playerId, gameId, event.team);
      playerStats.set(event.playerId, stats);
    }

    const updated = aggregateStatEvent(stats, event);
    playerStats.set(event.playerId, updated);
  }

  return playerStats;
}

/**
 * Gets team totals from player stats
 */
export function getTeamTotals(
  playerStats: PlayerGameStats[]
): Omit<PlayerGameStats, 'playerId' | 'lastUpdated'> {
  const totals = {
    gameId: '',
    team: playerStats[0]?.team || 'home',
    points1pt: 0,
    points2pt: 0,
    points3pt: 0,
    reboundsOff: 0,
    reboundsDef: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    pointsTotal: 0,
    reboundsTotal: 0,
  };

  for (const stats of playerStats) {
    totals.points1pt += stats.points1pt;
    totals.points2pt += stats.points2pt;
    totals.points3pt += stats.points3pt;
    totals.reboundsOff += stats.reboundsOff;
    totals.reboundsDef += stats.reboundsDef;
    totals.assists += stats.assists;
    totals.steals += stats.steals;
    totals.blocks += stats.blocks;
    totals.turnovers += stats.turnovers;
    totals.fouls += stats.fouls;
    totals.pointsTotal += stats.pointsTotal;
    totals.reboundsTotal += stats.reboundsTotal;
  }

  return totals;
}

/**
 * Filters events by stat type
 */
export function filterEventsByStatType(
  events: PlayerStatEvent[],
  statType: PrimaryStatType
): PlayerStatEvent[] {
  return events.filter((e) => e.statType === statType);
}

/**
 * Gets unique stat types from a list of events
 */
export function getUniqueStatTypes(events: PlayerStatEvent[]): PrimaryStatType[] {
  const types = new Set<PrimaryStatType>();
  for (const event of events) {
    if (event.statType) {
      types.add(event.statType);
    }
  }
  return Array.from(types);
}
