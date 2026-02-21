import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema for HoopHoop Basketball Scoring App
 * 
 * This schema defines tables for real-time game state management,
 * replacing the Socket.io implementation with Convex's reactive database.
 */

export default defineSchema({
  /**
   * Game State Table
   * Stores the real-time state of active games for Convex subscriptions
   */
  gameStates: defineTable({
    gameId: v.id("games"),
    // Score tracking
    homeScore: v.number(),
    guestScore: v.number(),
    // Fouls
    homeFouls: v.number(),
    guestFouls: v.number(),
    // Timeouts
    homeTimeouts: v.number(),
    guestTimeouts: v.number(),
    // Clock
    clockSeconds: v.number(),
    isTimerRunning: v.boolean(),
    timerStartedAt: v.optional(v.number()), // timestamp in ms
    currentPeriod: v.number(),
    // Possession
    possession: v.optional(v.union(v.literal("home"), v.literal("guest"))),
    // Status
    status: v.union(
      v.literal("scheduled"),
      v.literal("live"),
      v.literal("final")
    ),
    // Metadata
    updatedAt: v.number(), // timestamp in ms
    updatedBy: v.optional(v.string()), // user ID who made last update
  })
    .index("by_game", ["gameId"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updatedAt"]),

  /**
   * Game Events Table (Real-time)
   * Stores game events that are synced in real-time
   */
  gameEvents: defineTable({
    gameId: v.id("games"),
    eventId: v.optional(v.string()), // Client-generated ID for deduplication
    type: v.union(
      v.literal("score"),
      v.literal("foul"),
      v.literal("timeout"),
      v.literal("sub"),
      v.literal("turnover"),
      v.literal("block"),
      v.literal("steal"),
      v.literal("rebound_off"),
      v.literal("rebound_def"),
      v.literal("period_start"),
      v.literal("period_end"),
      v.literal("clock_start"),
      v.literal("clock_stop"),
      v.literal("undo"),
      v.literal("miss")
    ),
    period: v.number(),
    clockAt: v.number(),
    team: v.optional(v.union(v.literal("home"), v.literal("guest"))),
    player: v.optional(v.string()),
    gameRosterId: v.optional(v.id("gameRosters")),
    value: v.optional(v.number()),
    metadata: v.optional(v.any()),
    description: v.string(),
    createdAt: v.number(), // timestamp in ms
    createdBy: v.optional(v.string()), // user ID
  })
    .index("by_game", ["gameId"])
    .index("by_game_created", ["gameId", "createdAt"]),

  /**
   * Game Presence Table
   * Tracks active users in a game (scorers, spectators)
   */
  gamePresence: defineTable({
    gameId: v.id("games"),
    userId: v.string(),
    role: v.union(v.literal("scorer"), v.literal("spectator")),
    lastSeenAt: v.number(), // timestamp in ms
    clientId: v.string(), // unique per session
  })
    .index("by_game", ["gameId"])
    .index("by_user", ["userId"])
    .index("by_game_user", ["gameId", "userId"]),

  /**
   * Timer Sync Table
   * Tracks timer state for synchronization across clients
   */
  timerSync: defineTable({
    gameId: v.id("games"),
    isRunning: v.boolean(),
    startedAt: v.optional(v.number()), // timestamp in ms
    initialClockSeconds: v.number(),
    currentClockSeconds: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index("by_game", ["gameId"]),

  /**
   * Public Games Index
   * For efficient querying of public live games
   */
  publicGames: defineTable({
    gameId: v.id("games"),
    homeTeamName: v.string(),
    guestTeamName: v.string(),
    homeScore: v.number(),
    guestScore: v.number(),
    clockSeconds: v.number(),
    currentPeriod: v.number(),
    status: v.union(v.literal("scheduled"), v.literal("live"), v.literal("final")),
    communityId: v.optional(v.id("communities")),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_community", ["communityId"])
    .index("by_updated", ["updatedAt"]),

  /**
   * Community Games Index
   * For community-specific game listings
   */
  communityGames: defineTable({
    gameId: v.id("games"),
    communityId: v.id("communities"),
    homeTeamName: v.string(),
    guestTeamName: v.string(),
    homeScore: v.number(),
    guestScore: v.number(),
    status: v.union(v.literal("scheduled"), v.literal("live"), v.literal("final")),
    updatedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_community_status", ["communityId", "status"])
    .index("by_updated", ["updatedAt"]),
});
