import { vi } from 'vitest';

/** Shape of a games DB row used in tests */
export interface MockGame {
  id: string;
  homeScore: number;
  guestScore: number;
  homeFouls: number;
  guestFouls: number;
  currentPeriod: number;
  clockSeconds: number;
}

/** Shape of a gameEvents DB row used in tests */
export interface MockEvent {
  id: string;
  gameId: string;
  type: string;
  team: string;
  player: string | null;
  value: number;
  description: string;
  game: { ownerId: string };
}

/** Returns a valid games DB row with sensible defaults */
export function createMockGame(overrides?: Partial<Omit<MockGame, 'game'>>): MockGame {
  return {
    id: 'game-1',
    homeScore: 0,
    guestScore: 0,
    homeFouls: 0,
    guestFouls: 0,
    currentPeriod: 1,
    clockSeconds: 600,
    ...overrides,
  };
}

/** Returns a valid gameEvents DB row with sensible defaults */
export function createMockEvent(
  overrides?: Partial<Omit<MockEvent, 'game'>> & { game?: { ownerId: string } }
): MockEvent {
  const { game, ...rest } = overrides ?? {};
  return {
    id: 'event-1',
    gameId: 'game-1',
    type: 'score',
    team: 'home',
    player: null,
    value: 2,
    description: '2 pointer',
    game: game ?? { ownerId: 'user_owner' },
    ...rest,
  };
}

/** In-memory mock of the Drizzle db object */
export function createMockDb(initialGame?: MockGame): {
  db: {
    query: {
      games: { findFirst: ReturnType<typeof vi.fn> };
      gameEvents: { findFirst: ReturnType<typeof vi.fn> };
      gameRosters: { findFirst: ReturnType<typeof vi.fn> };
    };
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  gameState: { homeScore: number; guestScore: number; homeFouls: number; guestFouls: number };
} {
  const gameState = {
    homeScore: initialGame?.homeScore ?? 0,
    guestScore: initialGame?.guestScore ?? 0,
    homeFouls: initialGame?.homeFouls ?? 0,
    guestFouls: initialGame?.guestFouls ?? 0,
  };

  const db = {
    query: {
      games: {
        findFirst: vi.fn().mockResolvedValue(initialGame ?? createMockGame()),
      },
      gameEvents: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      gameRosters: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      })),
    })),
    update: vi.fn(() => {
      const mockWhere = {
        returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      };
      const mockSet = {
        where: vi.fn().mockReturnValue(mockWhere),
      };
      return {
        set: vi.fn().mockReturnValue(mockSet),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
    })),
  };

  return { db, gameState };
}

/** Returns a mock of the graphqlRequest used for Hasura sync */
export function createMockHasuraSync(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    update_game_states: { affected_rows: 1 },
  });
}
