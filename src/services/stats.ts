/**
 * Stat configuration and recording service
 * Feature: 078-configurable-player-stats
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  gameStatConfigs,
  gameScorers,
  gameEvents,
  seasons,
  communities,
} from '@/db/schema';
import {
  PrimaryStatType,
  type GameStatConfig,
  type ScorerStatFocus,
  type PlayerStatEvent,
  type UpdateStatConfigRequest,
  type UpdateScorerFocusRequest,
  type StatConfigInheritance,
} from '@/types/stats';
import {
  validateEnabledStats,
  validateScorerFocus,
  createDefaultGameStatConfig,
  getDefaultStatFocus,
  DEFAULT_ENABLED_STATS,
} from '@/lib/stats/stat-types';

/**
 * Gets or creates stat config for a game
 */
export async function getOrCreateStatConfig(
  gameId: string,
  seasonId?: string,
  communityId?: string,
  userId?: string
): Promise<GameStatConfig> {
  // Try to get existing config
  const existing = await db.query.gameStatConfigs.findFirst({
    where: eq(gameStatConfigs.gameId, gameId),
  });

  if (existing) {
    return existing as GameStatConfig;
  }

  // Create default config
  const defaults = createDefaultGameStatConfig(gameId, userId);
  const [created] = await db
    .insert(gameStatConfigs)
    .values({
      ...defaults,
      seasonId,
      communityId,
    })
    .returning();

  return created as GameStatConfig;
}

/**
 * Updates stat configuration for a game
 */
export async function updateStatConfig(
  gameId: string,
  request: UpdateStatConfigRequest,
  userId: string
): Promise<{ success: boolean; config?: GameStatConfig; errors?: string[] }> {
  // Validate enabled stats
  const validation = validateEnabledStats(request.enabledStats);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Check for existing events if disabling stats
  const existingConfig = await db.query.gameStatConfigs.findFirst({
    where: eq(gameStatConfigs.gameId, gameId),
  });

  if (existingConfig) {
    const currentEnabled = existingConfig.enabledStats as PrimaryStatType[];
    const newEnabled = new Set(request.enabledStats);

    const disabledStats = currentEnabled.filter((stat) => !newEnabled.has(stat));

    if (disabledStats.length > 0) {
      // Check if any disabled stats have recorded events
      for (const statType of disabledStats) {
        const eventCount = await db.$count(
          gameEvents,
          and(
            eq(gameEvents.gameId, gameId),
            eq(gameEvents.statType, statType)
          )
        );

        if (eventCount > 0) {
          return {
            success: false,
            errors: [
              `Cannot disable "${statType}" - ${eventCount} events already recorded. Existing data will be hidden but not deleted.`,
            ],
          };
        }
      }
    }
  }

  // Update or create config
  const [updated] = await db
    .insert(gameStatConfigs)
    .values({
      gameId,
      enabledStats: request.enabledStats as PrimaryStatType[],
      displayConfig: request.displayConfig || {},
      allowCustomization: request.allowCustomization ?? true,
      trackFullHistory: request.trackFullHistory ?? false,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: gameStatConfigs.gameId,
      set: {
        enabledStats: request.enabledStats as PrimaryStatType[],
        displayConfig: request.displayConfig || {},
        allowCustomization: request.allowCustomization ?? true,
        trackFullHistory: request.trackFullHistory ?? false,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    })
    .returning();

  return { success: true, config: updated as GameStatConfig };
}

/**
 * Gets the inheritance chain for stat configuration
 */
export async function getStatConfigInheritance(
  gameId: string,
  seasonId?: string,
  communityId?: string
): Promise<StatConfigInheritance> {
  const result: StatConfigInheritance = {
    game: {
      enabledStats: [],
      source: 'game_override',
    },
  };

  // Get game config
  const gameConfig = await db.query.gameStatConfigs.findFirst({
    where: eq(gameStatConfigs.gameId, gameId),
  });

  if (gameConfig) {
    result.game.enabledStats = gameConfig.enabledStats as PrimaryStatType[];
  } else {
    result.game.enabledStats = [...DEFAULT_ENABLED_STATS];
  }

  // Get season config if available
  if (seasonId) {
    const season = await db.query.seasons.findFirst({
      where: eq(seasons.id, seasonId),
    });

    if (season) {
      const seasonConfig = await db.query.gameStatConfigs.findFirst({
        where: eq(gameStatConfigs.seasonId, seasonId),
      });

      result.season = {
        id: seasonId,
        name: season.name,
        enabledStats: seasonConfig
          ? (seasonConfig.enabledStats as PrimaryStatType[])
          : [...DEFAULT_ENABLED_STATS],
        source: 'season_default',
      };
    }
  }

  // Get community config if available
  if (communityId) {
    const community = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
    });

    if (community) {
      const communityConfig = await db.query.gameStatConfigs.findFirst({
        where: eq(gameStatConfigs.communityId, communityId),
      });

      result.community = {
        id: communityId,
        name: community.name,
        enabledStats: communityConfig
          ? (communityConfig.enabledStats as PrimaryStatType[])
          : [...DEFAULT_ENABLED_STATS],
        source: 'community_default',
      };
    }
  }

  return result;
}

/**
 * Gets or creates scorer stat focus for a game
 */
export async function getOrCreateScorerFocus(
  gameId: string,
  userId: string,
  enabledStats: PrimaryStatType[]
): Promise<ScorerStatFocus> {
  const scorer = await db.query.gameScorers.findFirst({
    where: and(eq(gameScorers.gameId, gameId), eq(gameScorers.userId, userId)),
  });

  if (scorer?.statFocus) {
    return {
      statFocus: scorer.statFocus as PrimaryStatType[],
      showAllStats: scorer.showAllStats ?? false,
      focusUpdatedAt: scorer.focusUpdatedAt || undefined,
    };
  }

  // Return default focus
  return {
    statFocus: getDefaultStatFocus(enabledStats),
    showAllStats: false,
  };
}

/**
 * Updates scorer stat focus for a game
 */
export async function updateScorerFocus(
  gameId: string,
  userId: string,
  request: UpdateScorerFocusRequest,
  enabledStats: PrimaryStatType[]
): Promise<{ success: boolean; focus?: ScorerStatFocus; errors?: string[] }> {
  // Validate focus
  const validation = validateScorerFocus(request.statFocus, enabledStats);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Update scorer record
  await db
    .update(gameScorers)
    .set({
      statFocus: request.statFocus as PrimaryStatType[],
      showAllStats: request.showAllStats ?? false,
      focusUpdatedAt: new Date(),
    })
    .where(and(eq(gameScorers.gameId, gameId), eq(gameScorers.userId, userId)));

  return {
    success: true,
    focus: {
      statFocus: request.statFocus as PrimaryStatType[],
      showAllStats: request.showAllStats ?? false,
      focusUpdatedAt: new Date(),
    },
  };
}

/**
 * Gets all scorer focuses for a game
 */
export async function getAllScorerFocuses(
  gameId: string
): Promise<Array<{ userId: string; displayName: string; statFocus: PrimaryStatType[]; showAllStats: boolean }>> {
  const scorers = await db.query.gameScorers.findMany({
    where: eq(gameScorers.gameId, gameId),
    with: {
      user: true,
    },
  });

  return scorers.map((scorer) => ({
    userId: scorer.userId,
    displayName: scorer.user?.firstName
      ? `${scorer.user.firstName} ${scorer.user.lastName || ''}`.trim()
      : 'Unknown',
    statFocus: (scorer.statFocus as PrimaryStatType[]) || [],
    showAllStats: scorer.showAllStats ?? false,
  }));
}

/**
 * Records a stat event with audit trail
 */
export async function recordStatEvent(
  event: Omit<PlayerStatEvent, 'id' | 'createdAt' | 'version'>
): Promise<PlayerStatEvent> {
  const [created] = await db
    .insert(gameEvents)
    .values({
      gameId: event.gameId,
      type: 'stat',
      statType: event.statType,
      period: event.period,
      clockAt: event.clockAt,
      team: event.team,
      gameRosterId: event.playerId, // Using playerId as gameRosterId
      value: event.value,
      metadata: event.metadata || {},
      description: `${event.statType} recorded`,
      createdBy: event.createdBy,
      stat_type: event.statType,
      modified_by: event.createdBy,
      modified_at: new Date(),
      version: 1,
      previous_version: null,
    })
    .returning();

  return {
    id: created.id,
    gameId: created.gameId,
    playerId: created.gameRosterId || '',
    team: created.team || 'home',
    type: 'stat',
    statType: (created.statType || created.stat_type) as PrimaryStatType,
    value: created.value || 1,
    period: created.period,
    clockAt: created.clockAt,
    metadata: created.metadata as Record<string, unknown>,
    createdBy: created.createdBy || created.created_by,
    createdAt: created.createdAt,
    modifiedBy: created.modifiedBy || created.modified_by,
    modifiedAt: created.modifiedAt || created.modified_at,
    version: created.version || 1,
    previousVersion: created.previousVersion || created.previous_version,
  } as PlayerStatEvent;
}

/**
 * Updates a stat event (with audit trail)
 */
export async function updateStatEvent(
  eventId: string,
  updates: Partial<Pick<PlayerStatEvent, 'statType' | 'value' | 'playerId'>>,
  userId: string
): Promise<PlayerStatEvent | null> {
  // Get current event
  const current = await db.query.gameEvents.findFirst({
    where: eq(gameEvents.id, eventId),
  });

  if (!current) return null;

  // Store previous version
  const previousVersion = {
    statType: current.statType || current.stat_type,
    value: current.value,
    gameRosterId: current.gameRosterId,
  };

  // Update event
  const [updated] = await db
    .update(gameEvents)
    .set({
      statType: updates.statType || current.statType,
      stat_type: updates.statType || current.stat_type,
      value: updates.value !== undefined ? updates.value : current.value,
      gameRosterId: updates.playerId || current.gameRosterId,
      modifiedBy: userId,
      modified_by: userId,
      modifiedAt: new Date(),
      modified_at: new Date(),
      version: (current.version || 1) + 1,
      previousVersion: previousVersion,
      previous_version: previousVersion,
    })
    .where(eq(gameEvents.id, eventId))
    .returning();

  return {
    id: updated.id,
    gameId: updated.gameId,
    playerId: updated.gameRosterId || '',
    team: updated.team || 'home',
    type: 'stat',
    statType: (updated.statType || updated.stat_type) as PrimaryStatType,
    value: updated.value || 1,
    period: updated.period,
    clockAt: updated.clockAt,
    metadata: updated.metadata as Record<string, unknown>,
    createdBy: updated.createdBy || updated.created_by,
    createdAt: updated.createdAt,
    modifiedBy: updated.modifiedBy || updated.modified_by,
    modifiedAt: updated.modifiedAt || updated.modified_at,
    version: updated.version || 1,
    previousVersion: updated.previousVersion || updated.previous_version,
  } as PlayerStatEvent;
}
