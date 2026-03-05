import { vi } from 'vitest';

/**
 * GameState with version:1 and default values, overrideable.
 */
export interface GameState {
  homeScore: number;
  guestScore: number;
  homeFouls: number;
  guestFouls: number;
  homeTimeouts: number;
  guestTimeouts: number;
  clockSeconds: number;
  isTimerRunning: boolean;
  currentPeriod: number;
  possession?: 'home' | 'guest';
  status: 'scheduled' | 'live' | 'final';
  version: number;
}

/**
 * Creates a GameState with version:1 and sensible defaults.
 * Pass overrides to change specific fields.
 */
export function createVersionedGameState(overrides?: Partial<GameState>): GameState {
  return {
    homeScore: 0,
    guestScore: 0,
    homeFouls: 0,
    guestFouls: 0,
    homeTimeouts: 3,
    guestTimeouts: 3,
    clockSeconds: 600,
    isTimerRunning: false,
    currentPeriod: 1,
    possession: undefined,
    status: 'scheduled',
    version: 1,
    ...overrides,
  };
}

/**
 * Creates a controllable subscription mock.
 * Call `.push(data)` to deliver subscription events to all subscribers.
 * `queryIncludes` filters which subscription requests this mock intercepts.
 */
export function createControllableSubscription(queryIncludes: string): {
  push: (data: unknown) => void;
  mockSubscribe: ReturnType<typeof vi.fn>;
} {
  const handlers: Array<(result: { data: unknown }) => void> = [];

  const push = (data: unknown): void => {
    for (const handler of handlers) {
      handler({ data });
    }
  };

  const mockSubscribe = vi.fn(
    (
      request: { query?: string },
      { next }: { next?: (result: { data: unknown }) => void }
    ) => {
      const query = request.query ?? '';
      if (query.includes(queryIncludes) && next) {
        handlers.push(next);
      }
      return vi.fn();
    }
  );

  return { push, mockSubscribe };
}

/**
 * Creates a graphqlRequest mock that introduces `delayMs` latency before resolving.
 * Useful for simulating network round-trip time in race-condition tests.
 */
export function createDelayedGraphqlRequest(delayMs: number): ReturnType<typeof vi.fn> {
  return vi.fn(async (_query: string, _variables?: Record<string, unknown>) => {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return {};
  });
}

/**
 * Creates a graphqlRequest mock that rejects on the Nth call (1-indexed)
 * and resolves with `{}` on all other calls.
 */
export function createFailingGraphqlRequest(failOnNthCall: number): ReturnType<typeof vi.fn> {
  let callCount = 0;
  return vi.fn(async (_query: string, _variables?: Record<string, unknown>) => {
    callCount++;
    if (callCount === failOnNthCall) {
      throw new Error(`Simulated failure on call ${failOnNthCall}`);
    }
    return {};
  });
}


/**
 * Creates a game state with intentional score drift
 * (denormalized totals don't match event sums)
 */
export function buildDriftedGameState(overrides?: Partial<GameState>): GameState {
  return createVersionedGameState({
    homeScore: 10,  // Actual event sum should be different
    guestScore: 8,
    homeFouls: 2,
    guestFouls: 3,
    status: 'live',
    ...overrides,
  });
}

/**
 * Creates a mock for the recalculate API endpoint response
 */
export function buildRecalcMock(
  corrected: boolean = true,
  oldValues?: Partial<GameState>,
  newValues?: Partial<GameState>
): {
  corrected: boolean;
  oldValues: {
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
  };
  newValues: {
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
  };
  trigger: string;
  gameId: string;
  timestamp: string;
} {
  const defaultOld = {
    homeScore: 10,
    guestScore: 8,
    homeFouls: 2,
    guestFouls: 3,
  };

  const defaultNew = corrected
    ? {
        homeScore: 14,
        guestScore: 8,
        homeFouls: 2,
        guestFouls: 3,
      }
    : defaultOld;

  return {
    corrected,
    oldValues: { ...defaultOld, ...oldValues },
    newValues: { ...defaultNew, ...newValues },
    trigger: 'manual',
    gameId: 'test-game-id',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Asserts that hook state totals match expected event sums
 */
export function assertScoreIntegrity(
  state: GameState,
  expected: { homeScore: number; guestScore: number; homeFouls: number; guestFouls: number }
): void {
  if (
    state.homeScore !== expected.homeScore ||
    state.guestScore !== expected.guestScore ||
    state.homeFouls !== expected.homeFouls ||
    state.guestFouls !== expected.guestFouls
  ) {
    throw new Error(
      `Score integrity check failed:\n` +
        `Expected: ${JSON.stringify(expected)}\n` +
        `Actual: ${JSON.stringify({
          homeScore: state.homeScore,
          guestScore: state.guestScore,
          homeFouls: state.homeFouls,
          guestFouls: state.guestFouls,
        })}`
    );
  }
}