/**
 * @vitest-environment jsdom
 *
 * Regression tests for use-hasura-game hook.
 * T104: Bug-1 — single scorer with stale version must not show conflict banner
 * T105: Bug-3 — startTimer must not crash on network error (no unhandled rejection)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: "test-user-id" }),
}));

// Mock Hasura client
vi.mock("@/lib/hasura/client", () => {
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

import { useHasuraGame } from "../use-hasura-game";
import { getHasuraWsClient, graphqlRequest } from "@/lib/hasura/client";

// ---------------------------------------------------------------------------
// Shared subscription setup helper (mirrors use-hasura-game.test.ts)
// ---------------------------------------------------------------------------
function setupSubscription(): {
  pushGameState: (overrides?: Partial<{
    homeScore: number; guestScore: number; homeFouls: number; guestFouls: number;
    homeTimeouts: number; guestTimeouts: number; clockSeconds: number;
    isTimerRunning: boolean; currentPeriod: number; possession: string;
    status: string; version: number;
  }>) => void;
  pushTimerState: (overrides?: Partial<{
    isRunning: boolean; startedAt: string | null; initialClockSeconds: number; currentClockSeconds: number;
  }>) => void;
  pushScorers: (scorers: Array<{ id: string; user_id: string; role: string; joined_at: string; last_active_at: string }>) => void;
  pushGameEvents: (events: Array<{ id: string; type: string; team: string; value: number; period?: number; clockAt?: number; description?: string; createdAt?: string }>) => void;
} {
  const client = getHasuraWsClient();
  const mockSubscribe = vi.mocked(client.subscribe);
  let gameStateHandler: ((result: { data: unknown }) => void) | undefined;
  let timerHandler: ((result: { data: unknown }) => void) | undefined;
  let scorersHandler: ((result: { data: unknown }) => void) | undefined;
  let gameEventsHandler: ((result: { data: unknown }) => void) | undefined;

  mockSubscribe.mockImplementation((request, handlers) => {
    const query = request.query ?? '';
    if (query.includes('GetGameState') && handlers.next) {
      gameStateHandler = handlers.next;
    } else if (query.includes('GetTimerState') && handlers.next) {
      timerHandler = handlers.next;
    } else if (query.includes('GetGameScorers') && handlers.next) {
      scorersHandler = handlers.next;
    } else if (query.includes('GetGameEvents') && handlers.next) {
      gameEventsHandler = handlers.next;
    }
    return vi.fn();
  });

  const pushGameState = (overrides?: Partial<{
    homeScore: number; guestScore: number; homeFouls: number; guestFouls: number;
    homeTimeouts: number; guestTimeouts: number; clockSeconds: number;
    isTimerRunning: boolean; currentPeriod: number; possession: string;
    status: string; version: number;
  }>) => {
    gameStateHandler?.({
      data: {
        gameStates: [{
          gameId: 'game-reg',
          homeScore: 0, guestScore: 0, homeFouls: 0, guestFouls: 0,
          homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
          isTimerRunning: false, currentPeriod: 1, possession: 'home',
          status: 'live', updatedAt: new Date().toISOString(), version: 1,
          ...overrides,
        }],
      },
    });
  };

  const pushTimerState = (overrides?: Partial<{
    isRunning: boolean; startedAt: string | null; initialClockSeconds: number; currentClockSeconds: number;
  }>) => {
    timerHandler?.({
      data: {
        timerSync: [{
          gameId: 'game-reg',
          isRunning: false, startedAt: null, initialClockSeconds: 600, currentClockSeconds: 600,
          updatedAt: new Date().toISOString(),
          ...overrides,
        }],
      },
    });
  };

  const pushScorers = (scorers: Array<{ id: string; user_id: string; role: string; joined_at: string; last_active_at: string }>) => {
    scorersHandler?.({
      data: { game_scorers: scorers },
    });
  };

  const pushGameEvents = (events: Array<{ id: string; type: string; team: string; value: number; period?: number; clockAt?: number; description?: string; createdAt?: string }>) => {
    gameEventsHandler?.({
      data: {
        gameEvents: events.map(e => ({
          id: e.id,
          gameId: 'game-123',
          type: e.type,
          team: e.team,
          value: e.value,
          period: e.period ?? 1,
          clockAt: e.clockAt ?? 600,
          player: '',
          metadata: {},
          description: e.description ?? '',
          createdBy: 'test-user',
          createdAt: e.createdAt ?? new Date().toISOString(),
        })),
      },
    });
  };

  return { pushGameState, pushTimerState, pushScorers, pushGameEvents };
}

// ---------------------------------------------------------------------------
// T104 — Bug-1: single scorer with stale version must NOT show conflict banner
// ---------------------------------------------------------------------------
describe('REGRESSION: Bug-1 — stale version with single scorer must not trigger conflict banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('T104: single scorer with stale version must not show conflict banner', async () => {
    // All versioned updates return 0 affected_rows (simulates stale subscription version).
    // Re-fetch also returns 0 affected_rows on the retry.
    vi.mocked(graphqlRequest).mockImplementation(async (query: string) => {
      if (query.includes('UpdateGameStateVersioned')) {
        return { updateGameStates: { affected_rows: 0 } };
      }
      if (query.includes('GetCurrentGameState')) {
        // Re-fetch returns a newer version but the subsequent update also fails
        return {
          gameStates: [{
            homeScore: 0, guestScore: 0, homeFouls: 0, guestFouls: 0,
            homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
            isTimerRunning: false, currentPeriod: 1, possession: 'home',
            status: 'live', version: 99,
          }],
        };
      }
      return {};
    });

    const { pushGameState, pushScorers } = setupSubscription();
    const { result } = renderHook(() => useHasuraGame('game-reg'));

    pushGameState({ version: 1 });
    // Single scorer only — this is the bug-1 regression condition
    pushScorers([
      { id: 's1', user_id: 'user1', role: 'scorer', joined_at: new Date().toISOString(), last_active_at: new Date().toISOString() },
    ]);

    await waitFor(() => expect(result.current.gameState).toBeDefined());

    await act(async () => {
      await result.current.updateScore('home', 2);
    });

    // Must NOT set conflictDetected — single scorer path bypasses signalConflict
    expect(result.current.conflictDetected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T105 — Bug-3: startTimer must not crash on network error (no unhandled rejection)
// ---------------------------------------------------------------------------
describe('REGRESSION: Bug-3 — startTimer must not crash on network error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('T105: startTimer with graphqlRequest throwing must not produce unhandled rejection', async () => {
    // graphqlRequest always rejects (simulates total network outage)
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('network error'));

    const { pushGameState, pushTimerState } = setupSubscription();
    const { result } = renderHook(() => useHasuraGame('game-reg'));

    pushGameState({ version: 1 });
    pushTimerState({ isRunning: false, initialClockSeconds: 600, currentClockSeconds: 600 });

    await waitFor(() => expect(result.current.gameState).toBeDefined());

    // startTimer retries once after 200 ms — use fake timers to avoid real delays
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let caughtError: unknown = undefined;
    const startPromise = result.current.startTimer().catch((err: unknown) => {
      caughtError = err;
    });

    await vi.runAllTimersAsync();
    await startPromise;

    vi.useRealTimers();

    // The hook must have swallowed the error internally (sets timerError, does NOT re-throw)
    expect(caughtError).toBeUndefined();

    // timerError should be set to the error message
    await waitFor(() => expect(result.current.timerError).not.toBeNull());
  });
});

// ---------------------------------------------------------------------------
// T106 — Bug-3: PATCH event amendment must recalculate game totals
// ---------------------------------------------------------------------------
describe('REGRESSION: Bug-3 — PATCH event amendment must recalculate totals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('T106: PATCH changing event value must recalculate game totals and sync to Hasura', async () => {
    // Mock fetch for PATCH request to /api/games/[id]/events
    global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      // PATCH /api/games/game-123/events
      if (urlStr.includes('/api/games/') && urlStr.includes('/events') && options?.method === 'PATCH') {
        // BUG: Current implementation returns updated event but doesn't recalculate totals
        return Response.json({
          id: 'event-1',
          gameId: 'game-123',
          type: 'score',
          team: 'home',
          value: 3, // Changed from 2 to 3
          updatedAt: new Date().toISOString(),
        });
      }
      
      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    // Mock graphqlRequest to track Hasura sync calls
    const hasuraSyncCalls: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    vi.mocked(graphqlRequest).mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
      hasuraSyncCalls.push({ query, variables });
      
      if (query.includes('UPSERT_GAME_STATE')) {
        return { insert_game_states_one: { gameId: 'game-123', version: 2 } };
      }
      
      return {};
    });

    const { pushGameState, pushGameEvents } = setupSubscription();
    const { result } = renderHook(() => useHasuraGame('game-123'));

    // Initial state: home has 2 points from one event
    pushGameState({ version: 1, homeScore: 2, guestScore: 0 });
    // Seed events ref so PATCH intercept can compute delta (old: score home 2)
    pushGameEvents([{ id: 'event-1', type: 'score', team: 'home', value: 2 }]);
    await waitFor(() => expect(result.current.gameState?.homeScore).toBe(2));

    // Simulate PATCH request changing event value from 2 to 3
    const response = await fetch('/api/games/game-123/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'event-1',
        value: 3, // Changed from 2
      }),
    });

    expect(response.ok).toBe(true);
    const updatedEvent = await response.json();
    expect(updatedEvent.value).toBe(3);

    // BUG: PATCH handler should have:
    // 1. Calculated delta: -2 (old) +3 (new) = +1
    // 2. Updated game totals in database
    // 3. Called UPSERT_GAME_STATE_MUTATION to sync to Hasura with version increment
    // 4. Triggered subscription update with new totals

    // Expected: Hasura sync should have been called with updated score
    const hasuraUpserts = hasuraSyncCalls.filter(call => call.query.includes('UPSERT_GAME_STATE'));
    expect(hasuraUpserts.length).toBeGreaterThan(0); // WILL FAIL - no sync happens

    if (hasuraUpserts.length > 0) {
      const syncVars = hasuraUpserts[0].variables;
      expect(syncVars?.homeScore).toBe(3); // Should be 2 - 2 + 3 = 3
      expect(syncVars?._inc).toEqual({ version: 1 }); // Version should increment
    }

    // Expected: Subscription should push updated state
    // (In real implementation, backend would push this after PATCH + recalc)
    pushGameState({ version: 2, homeScore: 3, guestScore: 0 });
    await waitFor(() => expect(result.current.gameState?.homeScore).toBe(3));
    expect(result.current.gameState?.version).toBe(2);
  });

  it('T106b: PATCH changing event type from score to foul must recalculate both score and fouls', async () => {
    // Mock fetch for PATCH request
    global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      if (urlStr.includes('/api/games/') && urlStr.includes('/events') && options?.method === 'PATCH') {
        return Response.json({
          id: 'event-1',
          gameId: 'game-123',
          type: 'foul', // Changed from 'score' to 'foul'
          team: 'home',
          value: 1,
          updatedAt: new Date().toISOString(),
        });
      }
      
      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const hasuraSyncCalls: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    vi.mocked(graphqlRequest).mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
      hasuraSyncCalls.push({ query, variables });
      
      if (query.includes('UPSERT_GAME_STATE')) {
        return { insert_game_states_one: { gameId: 'game-123', version: 2 } };
      }
      
      return {};
    });

    const { pushGameState, pushGameEvents } = setupSubscription();
    const { result } = renderHook(() => useHasuraGame('game-123'));

    // Initial: home has 2 points from score event, 0 fouls
    pushGameState({ version: 1, homeScore: 2, guestScore: 0, homeFouls: 0, guestFouls: 0 });
    // Seed events ref so PATCH intercept can compute delta (old: score home 2)
    pushGameEvents([{ id: 'event-1', type: 'score', team: 'home', value: 2 }]);
    await waitFor(() => {
      expect(result.current.gameState?.homeScore).toBe(2);
      expect(result.current.gameState?.homeFouls).toBe(0);
    });

    // PATCH changes event type from 'score' (value=2) to 'foul' (value=1)
    const response = await fetch('/api/games/game-123/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'event-1',
        type: 'foul',
        value: 1,
      }),
    });

    expect(response.ok).toBe(true);

    // BUG: PATCH should have:
    // 1. Reversed old: homeScore -= 2
    // 2. Applied new: homeFouls += 1
    // 3. Synced to Hasura with version increment

    const hasuraUpserts = hasuraSyncCalls.filter(call => call.query.includes('UPSERT_GAME_STATE'));
    expect(hasuraUpserts.length).toBeGreaterThan(0); // WILL FAIL - no sync

    if (hasuraUpserts.length > 0) {
      const syncVars = hasuraUpserts[0].variables;
      expect(syncVars?.homeScore).toBe(0); // 2 - 2 = 0
      expect(syncVars?.homeFouls).toBe(1); // 0 + 1 = 1
    }

    // Subscription would push updated state after backend PATCH + recalc
    pushGameState({ version: 2, homeScore: 0, guestScore: 0, homeFouls: 1, guestFouls: 0 });
    await waitFor(() => {
      expect(result.current.gameState?.homeScore).toBe(0);
      expect(result.current.gameState?.homeFouls).toBe(1);
    });
  });
});
