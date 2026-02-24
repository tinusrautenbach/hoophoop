/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: "test-user-id" }),
}));

// Define mocks inside the factory (hoisted)
vi.mock("@/lib/hasura/client", () => {
  // These are created fresh for each test via vi.clearAllMocks
  const mockSubscribe = vi.fn();
  const mockGraphqlRequest = vi.fn();
  
  return {
    getHasuraWsClient: () => ({
      subscribe: mockSubscribe,
      dispose: vi.fn(),
    }),
    graphqlRequest: mockGraphqlRequest,
    closeHasuraConnection: vi.fn(),
  };
});

// Import the hook after mocks are set up
import { useHasuraGame } from "../use-hasura-game";
import { getHasuraWsClient, graphqlRequest } from "@/lib/hasura/client";

describe("useHasuraGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(graphqlRequest).mockResolvedValue({});
    
    // Get the mock function from the mocked module
    const client = getHasuraWsClient();
    const mockSubscribe = vi.mocked(client.subscribe);
    
    // Default mock implementation for subscribe
    mockSubscribe.mockImplementation((request, handlers) => {
      const query = request.query || '';
      
      // Simulate subscription data based on query type
      setTimeout(() => {
        if (query.includes('GetGameState')) {
          handlers.next?.({
            data: {
              gameStates: [{
                gameId: 'game-123',
                homeScore: 10,
                guestScore: 8,
                homeFouls: 2,
                guestFouls: 1,
                homeTimeouts: 3,
                guestTimeouts: 3,
                clockSeconds: 600,
                isTimerRunning: false,
                currentPeriod: 1,
                possession: 'home',
                status: 'live',
                updatedAt: new Date().toISOString(),
              }],
            },
          });
        } else if (query.includes('GetGameEvents')) {
          handlers.next?.({
            data: {
              hasura_game_events: [{
                id: 'ev1',
                gameId: 'game-123',
                type: 'score',
                period: 1,
                clockAt: 600,
                team: 'home',
                player: 'P1',
                value: 2,
                metadata: {},
                description: 'desc',
                createdAt: new Date().toISOString(),
              }],
            },
          });
        } else if (query.includes('GetTimerState')) {
          handlers.next?.({
            data: {
              timerSync: [{
                gameId: 'game-123',
                isRunning: true,
                startedAt: null,
                initialClockSeconds: 600,
                currentClockSeconds: 590,
                updatedAt: new Date().toISOString(),
              }],
            },
          });
        }
      }, 0);
      
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should connect via WebSocket and set isConnected", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("should subscribe and update game state, events, and timer", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.gameState).toBeDefined();
      expect(result.current.gameState?.homeScore).toBe(10);
      expect(result.current.gameEvents.length).toBeGreaterThan(0);
      expect(result.current.isTimerRunning).toBe(true);
    });
  });

  it("should expose updateScore function", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.gameState).toBeDefined();
    });

    // Verify the function exists and can be called
    expect(typeof result.current.updateScore).toBe('function');
    
    // Call should not throw (graphqlRequest is mocked)
    await expect(result.current.updateScore("home", 2)).resolves.not.toThrow();
  });

  it("startTimer should not throw", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.gameState).toBeDefined();
    });

    await expect(result.current.startTimer()).resolves.not.toThrow();
  });

  it("addEvent should not throw", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.gameState).toBeDefined();
    });

    await expect(result.current.addEvent({ 
      type: 'score', 
      period: 1, 
      clockAt: 600, 
      team: 'home', 
      player: 'P1', 
      value: 2, 
      description: 'desc' 
    })).resolves.not.toThrow();
  });

  it("removeEvent should not throw", async () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.gameState).toBeDefined();
    });
    
    await expect(result.current.removeEvent("evt-1")).resolves.not.toThrow();
  });

  it("should handle error in graphql requests gracefully", async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(new Error("Network error"));
    
    const { result } = renderHook(() => useHasuraGame("game-123"));
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
    
    await expect(result.current.updateScore("home", 1)).rejects.toThrow();
  });
});
