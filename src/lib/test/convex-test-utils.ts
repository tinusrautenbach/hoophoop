import { ConvexReactClient } from "convex/react";

export function createTestConvexClient() {
  const client = new ConvexReactClient("http://localhost:3210");
  return client;
}

export function mockConvexUser(userId: string = "test-user-id") {
  return {
    userId,
    email: "test@example.com",
    name: "Test User",
  };
}

export function mockGameState(overrides = {}) {
  return {
    gameId: "test-game-id" as any,
    homeScore: 0,
    guestScore: 0,
    homeFouls: 0,
    guestFouls: 0,
    homeTimeouts: 3,
    guestTimeouts: 3,
    clockSeconds: 600,
    isTimerRunning: false,
    currentPeriod: 1,
    possession: null,
    status: "scheduled",
    updatedAt: Date.now(),
    updatedBy: "test-user-id",
    ...overrides,
  };
}

export function mockGameEvent(overrides = {}) {
  return {
    gameId: "test-game-id" as any,
    type: "score",
    period: 1,
    clockAt: 600,
    team: "home",
    player: "Player 1",
    value: 2,
    description: "Player 1 scored 2 points",
    createdAt: Date.now(),
    createdBy: "test-user-id",
    ...overrides,
  };
}
