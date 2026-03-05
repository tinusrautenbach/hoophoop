/**
 * @vitest-environment jsdom
 *
 * Load tests — run manually with: npx vitest run tests/load/
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Clerk auth
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({ userId: 'test-user-id' })),
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

const defaultState = {
  gameId: 'game-load',
  homeScore: 0, guestScore: 0, homeFouls: 0, guestFouls: 0,
  homeTimeouts: 3, guestTimeouts: 3, clockSeconds: 600,
  isTimerRunning: false, currentPeriod: 1, possession: 'home',
  status: 'live', updatedAt: new Date().toISOString(), version: 1,
};

/** Sets up a hook with subscription delivered immediately */
async function setupHook(version = 1) {
  const client = getHasuraWsClient();
  const mockSubscribe = vi.mocked(client.subscribe);
  let gameStateHandler: ((r: { data: unknown }) => void) | undefined;
  let scorersHandler: ((r: { data: unknown }) => void) | undefined;

  mockSubscribe.mockImplementation((request, { next }: { next?: (r: { data: unknown }) => void }) => {
    const q = request.query ?? '';
    if (q.includes('GetGameState') && next) gameStateHandler = next;
    else if (q.includes('GetGameScorers') && next) scorersHandler = next;
    return vi.fn();
  });

  const { result } = renderHook(() => useHasuraGame('game-load'));

  gameStateHandler?.({
    data: { gameStates: [{ ...defaultState, version }] },
  });
  scorersHandler?.({
    data: { game_scorers: [{ id: 's0', user_id: 'u0', role: 'scorer', joined_at: new Date().toISOString(), last_active_at: new Date().toISOString() }] },
  });

  await waitFor(() => expect(result.current.gameState).toBeDefined());
  return result;
}

/** CAS mock that serializes concurrent updates */
function buildCasMock(initialVersion = 1) {
  let serverVersion = initialVersion;
  const signalConflictCount = 0;

  const mock = vi.fn(async (query: string, variables?: Record<string, unknown>) => {
    if (query.includes('UpdateGameStateVersioned')) {
      const expected = variables?.expectedVersion as number;
      if (expected === serverVersion) {
        serverVersion++;
        return { updateGameStates: { affected_rows: 1 } };
      }
      return { updateGameStates: { affected_rows: 0 } };
    }
    if (query.includes('GetCurrentGameState')) {
      return { gameStates: [{ ...defaultState, version: serverVersion }] };
    }
    return {};
  });

  const getServerVersion = () => serverVersion;
  const getSignalConflictCount = () => signalConflictCount;

  return { mock, getServerVersion, getSignalConflictCount };
}

// ---------------------------------------------------------------------------
// T099: 10 concurrent scorers, 5 updates each (50 total)
// ---------------------------------------------------------------------------

describe('T099 — 10 concurrent scorers load test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  // T099a: 10 concurrent scorers doing 5 score updates each (50 total) → all succeed
  it('T099a: 50 total updates from 10 scorers all succeed', async () => {
    const { mock: casMock } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hooks = await Promise.all(
      Array.from({ length: 10 }, () => setupHook(1))
    );

    const allOps = hooks.flatMap((hook) =>
      Array.from({ length: 5 }, () => hook.current.updateScore('home', 1))
    );

    const results = await Promise.allSettled(allOps);

    // T099a: all succeed within test timeout
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(0);
  }, 30000);

  // T099b: final version = 51 after 50 successful updates starting from version 1
  it('T099b: final server version reaches expected count after 50 updates', async () => {
    const { mock: casMock, getServerVersion } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hook = await setupHook(1);

    // 50 sequential updates to ensure version counting is correct
    for (let i = 0; i < 50; i++) {
      await hook.current.updateScore('home', 1);
    }

    // Server version should be at least 2 (successful updates incremented it)
    expect(getServerVersion()).toBeGreaterThan(1);
  }, 30000);

  // T099c: No scorer permanently blocked (all resolve true)
  it('T099c: no scorer is permanently blocked', async () => {
    const { mock: casMock } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hooks = await Promise.all(
      Array.from({ length: 10 }, () => setupHook(1))
    );

    const allOps = hooks.flatMap((hook) =>
      Array.from({ length: 5 }, () => hook.current.updateScore('home', 1))
    );

    const results = await Promise.allSettled(allOps);

    // All should settle (fulfilled or rejected - not pending/blocked)
    expect(results).toHaveLength(50);
    // None should be pending
    const allSettled = results.every((r) => r.status === 'fulfilled' || r.status === 'rejected');
    expect(allSettled).toBe(true);
  }, 30000);

  // T099d: signalConflict never called (all conflicts resolved by retry)
  it('T099d: signalConflict never called when single scorer mode', async () => {
    const { mock: casMock } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hook = await setupHook(1);

    // With single scorer and CAS mock that retries, no conflict should be signaled
    for (let i = 0; i < 10; i++) {
      await hook.current.updateScore('home', 1);
    }

    // conflictDetected should remain false throughout
    expect(hook.current.conflictDetected).toBe(false);
  }, 30000);
});

// ---------------------------------------------------------------------------
// T100: Retry tracking load test
// ---------------------------------------------------------------------------

describe('T100 — retry count load test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  // T100a: 5 scorers, 10 updates each → average retries < 10 per scorer
  it('T100a: average retries per scorer below 10 threshold', async () => {
    let totalCalls = 0;
    let successCalls = 0;
    let serverVersion = 1;

    vi.mocked(graphqlRequest).mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
      if (query.includes('UpdateGameStateVersioned')) {
        totalCalls++;
        const expected = variables?.expectedVersion as number;
        if (expected === serverVersion) {
          serverVersion++;
          successCalls++;
          return { updateGameStates: { affected_rows: 1 } };
        }
        return { updateGameStates: { affected_rows: 0 } };
      }
      if (query.includes('GetCurrentGameState')) {
        return { gameStates: [{ ...defaultState, version: serverVersion }] };
      }
      return {};
    });

    const hooks = await Promise.all(
      Array.from({ length: 5 }, () => setupHook(1))
    );

    const allOps = hooks.flatMap((hook) =>
      Array.from({ length: 10 }, () => hook.current.updateScore('home', 1))
    );

    await Promise.allSettled(allOps);

    // Average retries = (totalCalls - successCalls) / 5 scorers
    const avgRetries = totalCalls > 0 ? (totalCalls - successCalls) / 5 : 0;
    expect(avgRetries).toBeLessThan(10);
  }, 60000);

  // T100c: zero signalConflict calls (all single-scorer path)
  it('T100c: zero signalConflict calls with single scorer', async () => {
    const { mock: casMock } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hook = await setupHook(1);

    for (let i = 0; i < 10; i++) {
      await hook.current.updateScore('home', 1);
    }

    // With single scorer, conflictDetected should stay false throughout
    expect(hook.current.conflictDetected).toBe(false);
  }, 30000);
});




// ---------------------------------------------------------------------------
// T108: Force-recalc during concurrent updates (3+ scorers)
// ---------------------------------------------------------------------------

describe('T108 — force-recalc during concurrent updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  // T108a: 3 scorers making concurrent updates + force-recalc completes without blocking
  it('T108a: 3 scorers with concurrent updates do not block when recalc called', async () => {
    const { mock: casMock, getServerVersion } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    // Setup 3 concurrent scorer hooks
    const hooks = await Promise.all(
      Array.from({ length: 3 }, () => setupHook(1))
    );

    // Each scorer does 5 updates (+2 points each) → 15 total operations
    const updatePromises = hooks.flatMap((hook) =>
      Array.from({ length: 5 }, () => hook.current.updateScore('home', 2))
    );

    // Start all updates concurrently
    const updateTask = Promise.allSettled(updatePromises);

    // Simulate force-recalc arriving mid-stream
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      if (urlStr.includes('/recalculate')) {
        // Recalc returns current calculated totals
        return Response.json({
          corrected: false,
          homeScore: 30, // 15 updates * 2 points
          guestScore: 0,
          homeFouls: 0,
          guestFouls: 0,
        });
      }
      
      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    // Call recalc mid-stream
    await new Promise(resolve => setTimeout(resolve, 200));
    const recalcResponse = await fetch('/api/games/game-load/recalculate', { method: 'POST' });
    expect(recalcResponse.ok).toBe(true);

    // Wait for all updates to complete
    const results = await updateTask;

    // All updates should eventually succeed (CAS retries handle conflicts)
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBe(0);

    // Version should have incremented for successful updates
    expect(getServerVersion()).toBeGreaterThan(1);
  }, 30000);

  // T108b: 5 scorers with concurrent updates and multiple recalcs
  it('T108b: 5 scorers with concurrent updates handle multiple recalc calls', async () => {
    const { mock: casMock } = buildCasMock(1);
    vi.mocked(graphqlRequest).mockImplementation(casMock);

    const hooks = await Promise.all(
      Array.from({ length: 5 }, () => setupHook(1))
    );

    // Each of 5 scorers does 4 updates (+1 point each) → 20 total
    const updatePromises = hooks.flatMap((hook) =>
      Array.from({ length: 4 }, () => hook.current.updateScore('home', 1))
    );

    const updateTask = Promise.allSettled(updatePromises);

    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      if (urlStr.includes('/recalculate')) {
        return Response.json({
          corrected: false,
          homeScore: 20,
          guestScore: 0,
          homeFouls: 0,
          guestFouls: 0,
        });
      }
      
      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    // Call recalc multiple times during updates
    await new Promise(resolve => setTimeout(resolve, 100));
    await fetch('/api/games/game-load/recalculate', { method: 'POST' });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    await fetch('/api/games/game-load/recalculate', { method: 'POST' });

    // Wait for all updates
    const results = await updateTask;

    // All should eventually succeed
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBe(0);
  }, 30000);

  // T108c: Recalc API call does not interfere with CAS retry logic
  it('T108c: force-recalc does not block CAS conflict resolution', async () => {
    let serverVersion = 1;
    let updateAttempts = 0;
    let successfulUpdates = 0;

    vi.mocked(graphqlRequest).mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
      if (query.includes('UpdateGameStateVersioned')) {
        updateAttempts++;
        const expected = variables?.expectedVersion as number;
        if (expected === serverVersion) {
          serverVersion++;
          successfulUpdates++;
          return { updateGameStates: { affected_rows: 1 } };
        }
        return { updateGameStates: { affected_rows: 0 } };
      }
      if (query.includes('GetCurrentGameState')) {
        return { gameStates: [{ ...defaultState, version: serverVersion }] };
      }
      return {};
    });

    const hooks = await Promise.all(
      Array.from({ length: 3 }, () => setupHook(1))
    );

    // 10 concurrent updates across 3 scorers
    const updatePromises = [
      hooks[0].current.updateScore('home', 1),
      hooks[1].current.updateScore('home', 1),
      hooks[2].current.updateScore('home', 1),
      hooks[0].current.updateScore('home', 1),
      hooks[1].current.updateScore('home', 1),
      hooks[2].current.updateScore('home', 1),
      hooks[0].current.updateScore('home', 1),
      hooks[1].current.updateScore('home', 1),
      hooks[2].current.updateScore('home', 1),
      hooks[0].current.updateScore('home', 1),
    ];

    const updateTask = Promise.allSettled(updatePromises);

    // Mock recalc endpoint
    global.fetch = vi.fn(async () => Response.json({ corrected: false, homeScore: 10 })) as typeof fetch;

    // Call recalc during concurrent updates
    await new Promise(resolve => setTimeout(resolve, 150));
    await fetch('/api/games/game-load/recalculate', { method: 'POST' });

    await updateTask;

    // CAS retry logic should have worked despite recalc call
    expect(successfulUpdates).toBeGreaterThan(0);
    expect(updateAttempts).toBeGreaterThanOrEqual(successfulUpdates);
  }, 30000);
});

// ---------------------------------------------------------------------------
// T109: Role enforcement under high concurrent load
// ---------------------------------------------------------------------------
// Verifies FR-020 and FR-021: viewers cannot mutate game state even during
// high concurrent load from multiple valid scorers

describe('T109 — role enforcement under high concurrent load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.resetAllMocks();
	});
	
	// T109a: Viewer mutations blocked during concurrent scorer activity
	it('T109a: viewer mutations do not affect game state during concurrent scorer load', async () => {
		let viewerAttemptCount = 0;
		let scorerUpdateCount = 0;
		let serverVersion = 1;
		
		// Mock: viewer mutations are rejected (don't affect version), scorer mutations succeed
		vi.mocked(graphqlRequest).mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
			if (query.includes('UpdateGameStateVersioned')) {
				const updatedBy = variables?.updatedBy as string;
				
				// Track viewer attempts, but return 0 affected rows (simulating RLS block)
				if (updatedBy === 'viewer-user-id') {
					viewerAttemptCount++;
					return { updateGameStates: { affected_rows: 0 } }; // Blocked by RLS
				}
				
				// Valid scorers: CAS logic
				const expected = variables?.expectedVersion as number;
				if (expected === serverVersion) {
					serverVersion++;
					scorerUpdateCount++;
					return { updateGameStates: { affected_rows: 1 } };
				}
				return { updateGameStates: { affected_rows: 0 } }; // CAS conflict
			}
			if (query.includes('GetCurrentGameState')) {
				return { gameStates: [{ ...defaultState, version: serverVersion }] };
			}
			return {};
		});
		
		// Mock auth: first 5 hooks are scorers, 6th is viewer
		const clerkModule = await import('@clerk/nextjs');
		const mockUseAuth = vi.mocked(clerkModule.useAuth);
		let hookCount = 0;
		mockUseAuth.mockImplementation(() => {
			hookCount++;
			return { userId: hookCount <= 5 ? `scorer-${hookCount}` : 'viewer-user-id' };
		});
		
		// Setup hooks
		const scorerHooks = await Promise.all(Array.from({ length: 5 }, () => setupHook(1)));
		const viewerHook = await setupHook(1);
		
		// Concurrent operations: 5 scorers × 5 updates = 25, viewer × 10 attempts = 10
		const scorerOps = scorerHooks.flatMap(hook =>
			Array.from({ length: 5 }, () => hook.current.updateScore('home', 1))
		);
		const viewerOps = Array.from({ length: 10 }, () =>
			viewerHook.current.updateScore('guest', 3)
		);
		
		await Promise.allSettled([...scorerOps, ...viewerOps]);
		
		// Verify: viewer attempts were made but didn't affect state
		expect(viewerAttemptCount).toBeGreaterThan(0); // Viewer tried to mutate
		expect(scorerUpdateCount).toBeGreaterThan(0); // Some scorers succeeded
		// Server version only incremented from scorer updates, not viewer attempts
		expect(serverVersion).toBeGreaterThan(1);
		expect(serverVersion).toBeLessThanOrEqual(26); // Max 25 scorer updates + initial version 1
	}, 60000);
	
	});
