/**
 * @vitest-environment jsdom
 *
 * Load tests — run manually with: npx vitest run tests/load/
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Clerk auth
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'test-user-id' }),
}));

// Mock hasura client
vi.mock('@/lib/hasura/client', () => {
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

import { useHasuraGame } from '@/hooks/use-hasura-game';
import { getHasuraWsClient, graphqlRequest } from '@/lib/hasura/client';

// ---------------------------------------------------------------------------
// T101: Subscription stress test
// ---------------------------------------------------------------------------

describe('T101 — subscription stress test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  // T101a: 50 subscription events delivered rapidly → hook processes all, final version = 51
  it('T101a: 50 rapid subscription events processed, final version reflects last delivery', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({});

    const client = getHasuraWsClient();
    const mockSubscribe = vi.mocked(client.subscribe);
    let gameStateHandler: ((r: { data: unknown }) => void) | undefined;

    mockSubscribe.mockImplementation((request, { next }: { next?: (r: { data: unknown }) => void }) => {
      const q = request.query ?? '';
      if (q.includes('GetGameState') && next) gameStateHandler = next;
      return vi.fn();
    });

    const { result } = renderHook(() => useHasuraGame('game-stress'));

    // Deliver first event to ensure hook is connected
    gameStateHandler?.({
      data: {
        gameStates: [{
          gameId: 'game-stress',
          homeScore: 0, guestScore: 0, homeFouls: 0, guestFouls: 0,
          homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
          isTimerRunning: false, currentPeriod: 1, possession: 'home',
          status: 'live', updatedAt: new Date().toISOString(), version: 1,
        }],
      },
    });

    await waitFor(() => expect(result.current.gameState).toBeDefined());

    // Deliver 50 subscription events rapidly
    for (let i = 1; i <= 50; i++) {
      gameStateHandler?.({
        data: {
          gameStates: [{
            gameId: 'game-stress',
            homeScore: i, guestScore: 0, homeFouls: 0, guestFouls: 0,
            homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
            isTimerRunning: false, currentPeriod: 1, possession: 'home',
            status: 'live', updatedAt: new Date().toISOString(), version: i + 1,
          }],
        },
      });
    }

    // Hook should process all events and reflect the last one
    await waitFor(() => expect(result.current.gameState?.version).toBe(51));
  }, 30000);

  // T101b: gameState.version reflects last delivered value
  it('T101b: gameState.version reflects the last delivered subscription value', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({});

    const client = getHasuraWsClient();
    const mockSubscribe = vi.mocked(client.subscribe);
    let gameStateHandler: ((r: { data: unknown }) => void) | undefined;

    mockSubscribe.mockImplementation((request, { next }: { next?: (r: { data: unknown }) => void }) => {
      const q = request.query ?? '';
      if (q.includes('GetGameState') && next) gameStateHandler = next;
      return vi.fn();
    });

    const { result } = renderHook(() => useHasuraGame('game-stress-2'));

    const pushVersion = (v: number) => {
      gameStateHandler?.({
        data: {
          gameStates: [{
            gameId: 'game-stress-2',
            homeScore: v, guestScore: 0, homeFouls: 0, guestFouls: 0,
            homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
            isTimerRunning: false, currentPeriod: 1, possession: 'home',
            status: 'live', updatedAt: new Date().toISOString(), version: v,
          }],
        },
      });
    };

    // Deliver multiple versions
    pushVersion(1);
    pushVersion(5);
    pushVersion(10);
    pushVersion(42);

    await waitFor(() => expect(result.current.gameState?.version).toBe(42));
    expect(result.current.gameState?.version).toBe(42);
  }, 30000);
});
