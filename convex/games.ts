import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getGameState = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .first();
    return gameState;
  },
});

export const getGameEvents = query({
  args: {
    gameId: v.id("games"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("gameEvents")
      .withIndex("by_game_created", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(args.limit ?? 100);
    return events.reverse();
  },
});

export const getPublicGames = query({
  args: {
    status: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("final"))),
  },
  handler: async (ctx, args) => {
    const status = args.status ?? "live";
    const games = await ctx.db
      .query("publicGames")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(50);
    return games;
  },
});

export const getCommunityGames = query({
  args: {
    communityId: v.id("communities"),
    status: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("final"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("communityGames")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId));
    
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }
    
    const games = await query.order("desc").take(50);
    return games;
  },
});

export const getGamePresence = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("gamePresence")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    return presence;
  },
});

export const getTimerState = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const timer = await ctx.db
      .query("timerSync")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .first();
    return timer;
  },
});

export const updateGameState = mutation({
  args: {
    gameId: v.id("games"),
    updates: v.object({
      homeScore: v.optional(v.number()),
      guestScore: v.optional(v.number()),
      homeFouls: v.optional(v.number()),
      guestFouls: v.optional(v.number()),
      homeTimeouts: v.optional(v.number()),
      guestTimeouts: v.optional(v.number()),
      clockSeconds: v.optional(v.number()),
      currentPeriod: v.optional(v.number()),
      possession: v.optional(v.union(v.literal("home"), v.literal("guest"))),
      status: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("final"))),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    let gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .first();

    if (gameState) {
      await ctx.db.patch(gameState._id, {
        ...args.updates,
        updatedAt: now,
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("gameStates", {
        gameId: args.gameId,
        homeScore: args.updates.homeScore ?? 0,
        guestScore: args.updates.guestScore ?? 0,
        homeFouls: args.updates.homeFouls ?? 0,
        guestFouls: args.updates.guestFouls ?? 0,
        homeTimeouts: args.updates.homeTimeouts ?? 3,
        guestTimeouts: args.updates.guestTimeouts ?? 3,
        clockSeconds: args.updates.clockSeconds ?? 600,
        isTimerRunning: false,
        currentPeriod: args.updates.currentPeriod ?? 1,
        possession: args.updates.possession,
        status: args.updates.status ?? "scheduled",
        updatedAt: now,
        updatedBy: userId,
      });
    }

    const publicGame = await ctx.db
      .query("publicGames")
      .filter((q) => q.eq(q.field("gameId"), args.gameId))
      .first();

    if (publicGame) {
      await ctx.db.patch(publicGame._id, {
        ...args.updates,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const addGameEvent = mutation({
  args: {
    gameId: v.id("games"),
    event: v.object({
      eventId: v.optional(v.string()),
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
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const eventId = await ctx.db.insert("gameEvents", {
      gameId: args.gameId,
      ...args.event,
      createdAt: Date.now(),
      createdBy: userId,
    });

    return { success: true, eventId };
  },
});

export const controlTimer = mutation({
  args: {
    gameId: v.id("games"),
    action: v.union(v.literal("start"), v.literal("stop")),
    clockSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    
    let timer = await ctx.db
      .query("timerSync")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .first();

    if (args.action === "start") {
      if (timer) {
        await ctx.db.patch(timer._id, {
          isRunning: true,
          startedAt: now,
          initialClockSeconds: args.clockSeconds ?? timer.currentClockSeconds,
          currentClockSeconds: args.clockSeconds ?? timer.currentClockSeconds,
          updatedAt: now,
          updatedBy: userId,
        });
      } else {
        await ctx.db.insert("timerSync", {
          gameId: args.gameId,
          isRunning: true,
          startedAt: now,
          initialClockSeconds: args.clockSeconds ?? 600,
          currentClockSeconds: args.clockSeconds ?? 600,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    } else {
      if (timer) {
        await ctx.db.patch(timer._id, {
          isRunning: false,
          startedAt: undefined,
          currentClockSeconds: args.clockSeconds ?? timer.currentClockSeconds,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    let gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .first();

    if (gameState) {
      await ctx.db.patch(gameState._id, {
        isTimerRunning: args.action === "start",
        timerStartedAt: args.action === "start" ? now : undefined,
        clockSeconds: args.clockSeconds ?? gameState.clockSeconds,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    return { success: true, action: args.action };
  },
});

export const joinGame = mutation({
  args: {
    gameId: v.id("games"),
    role: v.union(v.literal("scorer"), v.literal("spectator")),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("gamePresence")
      .withIndex("by_game_user", (q) => 
        q.eq("gameId", args.gameId).eq("userId", userId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        lastSeenAt: now,
        clientId: args.clientId,
      });
    } else {
      await ctx.db.insert("gamePresence", {
        gameId: args.gameId,
        userId,
        role: args.role,
        lastSeenAt: now,
        clientId: args.clientId,
      });
    }

    return { success: true };
  },
});

export const leaveGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false };
    }

    const existing = await ctx.db
      .query("gamePresence")
      .withIndex("by_game_user", (q) => 
        q.eq("gameId", args.gameId).eq("userId", userId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

export const deleteGameEvent = mutation({
  args: {
    eventId: v.id("gameEvents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.eventId);
    return { success: true };
  },
});
