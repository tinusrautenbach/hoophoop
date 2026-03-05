/**
 * Regression tests for the events route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    query: {
      games: { findFirst: vi.fn() },
      gameEvents: { findFirst: vi.fn() },
      gameRosters: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'event-1', type: 'score', team: 'home', value: 2 }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_owner' }),
}));

vi.mock('@/lib/auth-permissions', () => ({
  canManageGame: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/hasura/client', () => ({
  graphqlRequest: vi.fn().mockResolvedValue({}),
}));

import { POST } from '@/app/api/games/[id]/events/route';
import { graphqlRequest } from '@/lib/hasura/client';
import { db } from '@/db';

describe('REGRESSION: Bug-2 — score event insert must sync game_states', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (db.query.games.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'game-bug2',
      ownerId: 'user_owner',
      currentPeriod: 1,
      clockSeconds: 600,
      homeScore: 0,
      guestScore: 0,
      homeFouls: 0,
      guestFouls: 0,
    });

    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'event-1', type: 'score', team: 'home', value: 2 }]),
      }),
    });

    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    (graphqlRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('POST score event must call UPSERT_GAME_STATE_MUTATION', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ type: 'score', team: 'home', value: 2, player: 'Player1' }),
      }),
      { params: Promise.resolve({ id: 'game-bug2' }) }
    );

    expect(response.status).toBe(200);
    // graphqlRequest should have been called for the UPSERT_GAME_STATE_MUTATION
    expect(graphqlRequest).toHaveBeenCalled();
    const calls = (graphqlRequest as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const upsertCall = calls.find(([q]: [string]) =>
      q.includes('UpsertGameStateAfterEventDelete') || q.includes('update_game_states') || q.includes('_inc: { version')
    );
    expect(upsertCall).toBeDefined();
  });
});
