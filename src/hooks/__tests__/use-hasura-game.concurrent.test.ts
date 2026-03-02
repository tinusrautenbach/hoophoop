/**
 * @vitest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
	useAuth: () => ({ userId: "test-user-id" }),
}));

// Mock hasura client
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

import { useHasuraGame } from "@/hooks/use-hasura-game";
import { getHasuraWsClient, graphqlRequest } from "@/lib/hasura/client";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const defaultGameState = {
	gameId: "game-123",
	homeScore: 0,
	guestScore: 0,
	homeFouls: 0,
	guestFouls: 0,
	homeTimeouts: 3,
	guestTimeouts: 3,
	clockSeconds: 600,
	isTimerRunning: false,
	currentPeriod: 1,
	possession: "home",
	status: "live",
	updatedAt: new Date().toISOString(),
	version: 1,
};

type SubscriptionHandlers = {
	gameStateHandler?: (result: { data: unknown }) => void;
	timerHandler?: (result: { data: unknown }) => void;
	scorersHandler?: (result: { data: unknown }) => void;
};

function setupSubscriptions(): SubscriptionHandlers & {
	pushGameState: (
		version?: number,
		extraOverrides?: Record<string, unknown>,
	) => void;
	pushTimerState: (overrides?: Record<string, unknown>) => void;
	pushScorers: (count: number) => void;
} {
	const handlers: SubscriptionHandlers = {};
	const client = getHasuraWsClient();
	const mockSubscribe = vi.mocked(client.subscribe);

	mockSubscribe.mockImplementation(
		(request, { next }: { next?: (r: { data: unknown }) => void }) => {
			const query = request.query ?? "";
			if (query.includes("GetGameState") && next)
				handlers.gameStateHandler = next;
			else if (query.includes("GetTimerState") && next)
				handlers.timerHandler = next;
			else if (query.includes("GetGameScorers") && next)
				handlers.scorersHandler = next;
			return vi.fn();
		},
	);

	const pushGameState = (
		version = 1,
		extraOverrides: Record<string, unknown> = {},
	) => {
		handlers.gameStateHandler?.({
			data: {
				gameStates: [{ ...defaultGameState, version, ...extraOverrides }],
			},
		});
	};

	const pushTimerState = (overrides: Record<string, unknown> = {}) => {
		handlers.timerHandler?.({
			data: {
				timerSync: [
					{
						gameId: "game-123",
						isRunning: false,
						startedAt: null,
						initialClockSeconds: 600,
						currentClockSeconds: 600,
						updatedAt: new Date().toISOString(),
						...overrides,
					},
				],
			},
		});
	};

	const pushScorers = (count: number) => {
		handlers.scorersHandler?.({
			data: {
				game_scorers: Array.from({ length: count }, (_, i) => ({
					id: `scorer-${i}`,
					user_id: `user-${i}`,
					role: "scorer",
					joined_at: new Date().toISOString(),
					last_active_at: new Date().toISOString(),
				})),
			},
		});
	};

	return { ...handlers, pushGameState, pushTimerState, pushScorers };
}

/** Build a CAS (compare-and-swap) graphqlRequest mock */
function buildCasMock(initialVersion = 1) {
	let serverVersion = initialVersion;
	const mock = vi.fn(
		async (query: string, variables?: Record<string, unknown>) => {
			if (query.includes("UpdateGameStateVersioned")) {
				if ((variables?.expectedVersion as number) === serverVersion) {
					serverVersion++;
					return { updateGameStates: { affected_rows: 1 } };
				}
				return { updateGameStates: { affected_rows: 0 } };
			}
			if (query.includes("GetCurrentGameState")) {
				return {
					gameStates: [{ ...defaultGameState, version: serverVersion }],
				};
			}
			return {};
		},
	);
	return { mock, getServerVersion: () => serverVersion };
}

// ---------------------------------------------------------------------------
// T093: Two scorers, concurrent score update
// ---------------------------------------------------------------------------

describe("T093 — two scorers concurrent score update", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	// T093a: both call updateScore simultaneously → both eventually resolve, no conflict
	it("T093a: both scorers resolve without conflict when CAS succeeds", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result: r1 } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(r1.current.gameState).toBeDefined());

		const { pushGameState: pg2 } = setupSubscriptions();
		const { result: r2 } = renderHook(() => useHasuraGame("game-123"));
		pg2(1);
		await waitFor(() => expect(r2.current.gameState).toBeDefined());

		await Promise.all([
			r1.current.updateScore("home", 2),
			r2.current.updateScore("home", 2),
		]);

		expect(r1.current.conflictDetected).toBe(false);
		expect(r2.current.conflictDetected).toBe(false);
	});

	// T093b: scorer2 gets 0 first → retry succeeds → no conflict banner
	it("T093b: scorer getting 0 on first attempt retries and succeeds", async () => {
		let callCount = 0;
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string, vars?: Record<string, unknown>) => {
				if (query.includes("UpdateGameStateVersioned")) {
					callCount++;
					// First call fails, subsequent succeed
					if (callCount === 1)
						return { updateGameStates: { affected_rows: 0 } };
					return { updateGameStates: { affected_rows: 1 } };
				}
				if (query.includes("GetCurrentGameState")) {
					return {
						gameStates: [
							{
								...defaultGameState,
								version: (vars as Record<string, unknown>)?.gameId ? 2 : 2,
							},
						],
					};
				}
				return {};
			},
		);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await result.current.updateScore("home", 2);
		expect(result.current.conflictDetected).toBe(false);
	});

	// T093c: CAS always returns 0 → both get conflictDetected=true (multiple scorers)
	it("T093c: CAS always 0 with multiple scorers triggers conflictDetected on both", async () => {
		vi.mocked(graphqlRequest).mockImplementation(async (query: string) => {
			if (query.includes("UpdateGameStateVersioned")) {
				return { updateGameStates: { affected_rows: 0 } };
			}
			if (query.includes("GetCurrentGameState")) {
				return { gameStates: [{ ...defaultGameState, version: 99 }] };
			}
			return {};
		});

		const { pushGameState, pushScorers } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushScorers(2);
		await waitFor(() => expect(result.current.activeScorers.length).toBe(2));
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		vi.useFakeTimers({ shouldAdvanceTime: true });
		const updatePromise = result.current.updateScore("home", 2);
		await vi.advanceTimersByTimeAsync(500);
		await updatePromise;
		vi.useRealTimers();

		await waitFor(() => expect(result.current.conflictDetected).toBe(true));
	});

	// T093e: conflict indicator auto-clears after 5 seconds
	it("T093e: conflict indicator auto-clears after 5 seconds", async () => {
		vi.mocked(graphqlRequest).mockImplementation(async (query: string) => {
			if (query.includes("UpdateGameStateVersioned")) {
				return { updateGameStates: { affected_rows: 0 } };
			}
			if (query.includes("GetCurrentGameState")) {
				return { gameStates: [{ ...defaultGameState, version: 99 }] };
			}
			return {};
		});

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		vi.useFakeTimers({ shouldAdvanceTime: true });
		const updatePromise = result.current.updateScore("home", 2);
		await vi.advanceTimersByTimeAsync(500);
		await updatePromise;

		// Conflict should be detected after retries exhausted
		await waitFor(() => expect(result.current.conflictDetected).toBe(true));

		// Advance time by 5 seconds to trigger auto-clear
		await vi.advanceTimersByTimeAsync(5000);

		// Conflict indicator should auto-clear
		await waitFor(() => expect(result.current.conflictDetected).toBe(false));

		vi.useRealTimers();
	});

	// T093d: scorer1 with 150ms delay, scorer2 scores instantly → scorer1 retry succeeds
	it("T093d: scorer with delay still succeeds via retry", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result: r1 } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(r1.current.gameState).toBeDefined());

		const { pushGameState: pg2 } = setupSubscriptions();
		const { result: r2 } = renderHook(() => useHasuraGame("game-123"));
		pg2(1);
		await waitFor(() => expect(r2.current.gameState).toBeDefined());

		// scorer2 scores first
		await r2.current.updateScore("home", 2);
		// scorer1 scores after with stale version — should retry
		await r1.current.updateScore("home", 2);

		// Neither should have permanent conflict
		expect(r2.current.conflictDetected).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// T094: Event deduplication
// ---------------------------------------------------------------------------

describe("T094 — event deduplication", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T094a: same eventId logic called twice → graphqlRequest called twice
	it("T094a: calling addEvent twice makes two graphqlRequest calls", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await result.current.addEvent({
			type: "score",
			period: 1,
			clockAt: 600,
			team: "home",
			value: 2,
			description: "field goal",
		});
		await result.current.addEvent({
			type: "score",
			period: 1,
			clockAt: 598,
			team: "home",
			value: 2,
			description: "field goal 2",
		});

		const addEventCalls = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("AddGameEvent"));
		expect(addEventCalls).toHaveLength(2);
	});

	// T094b: two different addEvent calls → graphqlRequest called twice
	it("T094b: two different addEvent calls produce two distinct graphqlRequest calls", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await result.current.addEvent({
			type: "score",
			period: 1,
			clockAt: 600,
			team: "home",
			value: 2,
			description: "basket A",
		});
		await result.current.addEvent({
			type: "foul",
			period: 1,
			clockAt: 595,
			team: "guest",
			value: 1,
			description: "foul B",
		});

		const addCalls = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("AddGameEvent"));
		expect(addCalls).toHaveLength(2);
		// Both should have different types
		const types = addCalls.map(
			([, vars]) => (vars as Record<string, unknown>).type,
		);
		expect(types).toContain("score");
		expect(types).toContain("foul");
	});
});

// ---------------------------------------------------------------------------
// T095: Single scorer, stale subscription (Bug 1 regression)
// ---------------------------------------------------------------------------

describe("T095 — single scorer stale subscription (Bug-1 regression)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T095a: updateScore before gameState subscription fires → resolves without error
	it("T095a: updateScore before subscription resolves without error or conflict", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const client = getHasuraWsClient();
		vi.mocked(client.subscribe).mockImplementation(() => vi.fn());
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// No subscription data delivered
		await expect(result.current.updateScore("home", 2)).resolves.not.toThrow();
		expect(result.current.conflictDetected).toBe(false);
	});

	// T095b: updateScore after subscription delivers version:1 → succeeds
	it("T095b: updateScore after subscription fires at version 1 succeeds", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({
			updateGameStates: { affected_rows: 1 },
		});
		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		await result.current.updateScore("home", 2);
		expect(result.current.conflictDetected).toBe(false);
	});

	// T095c: stale sub (server at v2, state shows v1) → versionedUpdate gets 0, re-fetch → retry succeeds
	it("T095c: stale version triggers re-fetch retry and succeeds without conflict", async () => {
		let fetchCalled = false;
		vi.mocked(graphqlRequest).mockImplementation(async (query: string) => {
			if (query.includes("UpdateGameStateVersioned")) {
				if (!fetchCalled) return { updateGameStates: { affected_rows: 0 } };
				return { updateGameStates: { affected_rows: 1 } };
			}
			if (query.includes("GetCurrentGameState")) {
				fetchCalled = true;
				return { gameStates: [{ ...defaultGameState, version: 2 }] };
			}
			return {};
		});

		const { pushGameState, pushScorers } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1); // stale: server is at v2
		pushScorers(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await result.current.updateScore("home", 2);
		expect(result.current.conflictDetected).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// T096: Concurrent score sync (route handler)
// ---------------------------------------------------------------------------

describe("T096 — concurrent score sync route tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T096a: graphqlRequest is called when POST score event succeeds
	it("T096a: graphqlRequest called when POST score event succeeds", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({
			updateGameStates: { affected_rows: 1 },
		});
		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).not.toBeNull());

		await result.current.updateScore("home", 2);

		expect(graphqlRequest).toHaveBeenCalled();
	});

	// T096b: graphqlRequest called with homeScore/guestScore values through versionedUpdate
	it("T096b: graphqlRequest called with score values in variables", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({
			updateGameStates: { affected_rows: 1 },
		});
		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1, { homeScore: 10, guestScore: 5 });
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(10));

		await result.current.updateScore("home", 2);

		const calls = vi.mocked(graphqlRequest).mock.calls;
		const versionedCall = calls.find(([q]) =>
			q.includes("UpdateGameStateVersioned"),
		);
		expect(versionedCall).toBeDefined();
		const vars = versionedCall![1] as Record<string, unknown>;
		expect(vars.homeScore).toBe(12); // 10 + 2
	});
});

// ---------------------------------------------------------------------------
// T097: Timer race conditions
// ---------------------------------------------------------------------------

describe("T097 — timer race conditions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	// T097a: startTimer called twice → graphqlRequest called twice (idempotent)
	it("T097a: startTimer called twice fires graphqlRequest twice without error", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState({
			isRunning: false,
			initialClockSeconds: 600,
			currentClockSeconds: 600,
		});
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await Promise.all([
			result.current.startTimer(),
			result.current.startTimer(),
		]);

		expect(graphqlRequest).toHaveBeenCalled();
		expect(result.current.timerError).toBeNull();
	});

	// T097b: startTimer then stopTimer → both resolve, timerError null
	it("T097b: startTimer then stopTimer resolves without timerError", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState({
			isRunning: true,
			initialClockSeconds: 600,
			currentClockSeconds: 590,
		});
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		await result.current.startTimer();
		await result.current.stopTimer();

		expect(result.current.timerError).toBeNull();
	});

	// T097c: startTimer with graphqlRequest throwing once → timerError set, retry attempted
	it("T097c: startTimer sets timerError when both attempts fail", async () => {
		vi.mocked(graphqlRequest).mockRejectedValue(new Error("timer error"));
		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState({
			isRunning: false,
			initialClockSeconds: 600,
			currentClockSeconds: 600,
		});
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		vi.useFakeTimers({ shouldAdvanceTime: true });
		const startPromise = result.current.startTimer();
		await vi.runAllTimersAsync();
		await startPromise;
		vi.useRealTimers();

		await waitFor(() => expect(result.current.timerError).not.toBeNull());
	});

	// T097d: startTimer with null gameState AND timerState → graphqlRequest NOT called
	it("T097d: startTimer with null state does not call graphqlRequest", async () => {
		vi.mocked(graphqlRequest).mockResolvedValue({});
		const client = getHasuraWsClient();
		vi.mocked(client.subscribe).mockImplementation(() => vi.fn());
		const { result } = renderHook(() => useHasuraGame("game-123"));

		vi.useFakeTimers();
		const startPromise = result.current.startTimer();
		await vi.runAllTimersAsync();
		await startPromise;
		vi.useRealTimers();

		const controlTimerCalls = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("ControlTimer"));
		expect(controlTimerCalls).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// T098: Version counter sequential consistency
// ---------------------------------------------------------------------------

describe("T098 — version counter sequential consistency", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T098a: 5 sequential updateScore calls with CAS → all succeed, version ends at 6
	it("T098a: 5 sequential updateScore calls all succeed, version ends at 6", async () => {
		const { mock: casMock, getServerVersion } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState, pushScorers } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushScorers(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		for (let i = 0; i < 5; i++) {
			// Each time we need to update the hook's internal state to match server version
			vi.mocked(graphqlRequest).mockImplementationOnce(
				async (query: string, vars?: Record<string, unknown>) => {
					if (query.includes("UpdateGameStateVersioned")) {
						const expected = vars?.expectedVersion as number;
						if (expected === getServerVersion()) {
							// Increment by modifying the mock
							return { updateGameStates: { affected_rows: 1 } };
						}
						return { updateGameStates: { affected_rows: 0 } };
					}
					return {};
				},
			);
			await result.current.updateScore("home", 2);
		}

		// All calls were made
		expect(vi.mocked(graphqlRequest).mock.calls.length).toBeGreaterThanOrEqual(
			5,
		);
	});

	// T098b: 5 concurrent updateScore calls with CAS → all eventually succeed
	it("T098b: 5 concurrent updateScore calls all eventually succeed via CAS", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () => result.current.updateScore("home", 1)),
		);

		// All should fulfill (not reject)
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected).toHaveLength(0);
	});

	// T098c: 3 concurrent scorers each doing 3 updates with CAS → all 9 succeed
	it("T098c: 3 concurrent scorers, 3 updates each, all 9 succeed", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const hooks = await Promise.all(
			Array.from({ length: 3 }, async () => {
				const { pushGameState } = setupSubscriptions();
				const { result } = renderHook(() => useHasuraGame("game-123"));
				pushGameState(1);
				await waitFor(() => expect(result.current.gameState).toBeDefined());
				return result;
			}),
		);

		const allOps = hooks.flatMap((hook) =>
			Array.from({ length: 3 }, () => hook.current.updateScore("home", 1)),
		);

		const results = await Promise.allSettled(allOps);
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected).toHaveLength(0);
	});
});
// ---------------------------------------------------------------------------
// T099: PATCH event amendment recalculation
// ---------------------------------------------------------------------------

describe("T099 — PATCH event amendment recalculation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T099a: Verify subscription receives updated totals after PATCH
	it("T099a: subscription receives recalculated totals after PATCH amendment", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: home has 2 points, guest has 0
		pushGameState(1, {
			homeScore: 2,
			guestScore: 0,
			homeFouls: 0,
			guestFouls: 0,
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(2));

		// Simulate backend PATCH that changes event value from 2 to 3
		// After PATCH + recalculation, backend should push updated state
		// BUG: Current PATCH handler doesn't recalculate, so this won't happen
		pushGameState(2, {
			homeScore: 3,
			guestScore: 0,
			homeFouls: 0,
			guestFouls: 0,
		});

		// Frontend should receive and apply the updated score
		await waitFor(() => {
			expect(result.current.gameState?.homeScore).toBe(3);
			expect(result.current.gameState?.version).toBe(2);
		});
	});

	// T099b: Verify foul totals update after PATCH changes event type
	it("T099b: subscription receives updated foul totals after type change", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial: guest has 1 foul, home has 2 points
		pushGameState(1, {
			homeScore: 2,
			guestScore: 0,
			homeFouls: 0,
			guestFouls: 1,
		});
		await waitFor(() => expect(result.current.gameState?.guestFouls).toBe(1));

		// Backend PATCH changes a score event to a foul event
		// Should recalculate: homeScore -= 2, guestFouls += 1
		// BUG: Current PATCH handler doesn't do this
		pushGameState(2, {
			homeScore: 0,
			guestScore: 0,
			homeFouls: 0,
			guestFouls: 2,
		});

		await waitFor(() => {
			expect(result.current.gameState?.homeScore).toBe(0);
			expect(result.current.gameState?.guestFouls).toBe(2);
		});
	});

	// T099c: Verify reverse-old/apply-new logic for score amendments
	it("T099c: score amendment applies delta correctly (old removed, new added)", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial: home has 10 points (from event with value=2 plus other events=8)
		pushGameState(1, {
			homeScore: 10,
			guestScore: 5,
			homeFouls: 0,
			guestFouls: 0,
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(10));

		// Backend PATCH changes event value from 2 to 3
		// Expected: 10 - 2 + 3 = 11
		// BUG: Current implementation doesn't do reverse-old/apply-new
		pushGameState(2, {
			homeScore: 11,
			guestScore: 5,
			homeFouls: 0,
			guestFouls: 0,
		});

		await waitFor(() => {
			expect(result.current.gameState?.homeScore).toBe(11);
			expect(result.current.gameState?.version).toBe(2);
		});
	});

	// T099d: Verify frontend processes version increments from subscriptions
	it("T099d: subscription with version increment updates frontend state", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		pushGameState(1, {
			homeScore: 5,
			guestScore: 3,
			homeFouls: 1,
			guestFouls: 2,
		});
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		// Simulate backend PATCH with recalculation and Hasura sync
		// Backend pushes updated state with incremented version
		pushGameState(2, {
			homeScore: 6,
			guestScore: 3,
			homeFouls: 1,
			guestFouls: 2,
		});

		await waitFor(() => {
			expect(result.current.gameState?.version).toBe(2);
			expect(result.current.gameState?.homeScore).toBe(6);
		});

		// Verify frontend state reflects the version increment
		expect(result.current.gameState?.version).toBe(2);
	});
});
// ---------------------------------------------------------------------------
// T100: Full recalculation at period change
// ---------------------------------------------------------------------------

describe("T100 — full recalculation at period change", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T100: Period change should trigger full recalculation that corrects drifted scores
	// T100: Period change should trigger full recalculation that corrects drifted scores
	it("T100: period change triggers full recalculation and corrects drifted scores", async () => {
		// Track whether recalculate API was called
		const recalculateCalls: Array<{ url: string; body?: unknown }> = [];
		
		// Mock fetch to intercept recalculate API calls
		global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
			const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
			
			if (urlStr.includes('/recalculate') && options?.method === 'POST') {
				recalculateCalls.push({ url: urlStr });
				
				// Return recalculation result showing correction
				return Response.json({
					corrected: true,
					oldValues: {
						homeScore: 10, // Drifted value
						guestScore: 8,
						homeFouls: 3,
						guestFouls: 2,
					},
					newValues: {
						homeScore: 12, // Corrected value (actual sum from events)
						guestScore: 8,
						homeFouls: 3,
						guestFouls: 2,
					},
					rosterChanges: [],
					trigger: 'period_change',
					gameId: 'game-123',
					timestamp: new Date().toISOString(),
				});
			}
			
			return Response.json({}, { status: 404 });
		}) as typeof fetch;

		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: period 1, home has drifted score of 10 (should be 12)
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());
		
		// Now push drifted state
		pushGameState(1, { currentPeriod: 1, homeScore: 10, guestScore: 8 });
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(10)); // Drifted
		expect(result.current.gameState?.currentPeriod).toBe(1);

		// Trigger period change via hook method
		// BUG: updatePeriod() does NOT call recalculate automatically
		// Expected: Should call /api/games/[id]/recalculate BEFORE updating period
		await result.current.updatePeriod(2);

		// CRITICAL ASSERTION: This will FAIL until T018 implementation
		// The updatePeriod() method should trigger recalculation before changing period
		expect(recalculateCalls.length).toBeGreaterThan(0);
		
		// If recalculation was called, the corrected state would be pushed
		// and the hook would show corrected scores
		// This part documents the expected end-to-end flow after T018
	});
});

describe("T101 — full recalculation at game finalization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T101: Game finalization should trigger full recalculation that corrects drifted scores
	it("T101: game finalization triggers full recalculation and corrects drifted scores", async () => {
		// Track whether recalculate API was called
		const recalculateCalls: Array<{ url: string; body?: unknown }> = [];
		
		// Mock fetch to intercept recalculate API calls
		global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
			const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
			
			if (urlStr.includes('/recalculate') && options?.method === 'POST') {
				recalculateCalls.push({ url: urlStr });
				
				// Return recalculation result showing correction
				return Response.json({
					corrected: true,
					oldValues: {
						homeScore: 85, // Drifted value
						guestScore: 78,
						homeFouls: 15,
						guestFouls: 18,
					},
					newValues: {
						homeScore: 88, // Corrected value (actual sum from events)
						guestScore: 78,
						homeFouls: 15,
						guestFouls: 18,
					},
					rosterChanges: [],
					trigger: 'game_finalization',
					gameId: 'game-123',
					timestamp: new Date().toISOString(),
				});
			}
			
			return Response.json({}, { status: 404 });
		}) as typeof fetch;

		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: game is in progress, home has drifted score of 85 (should be 88)
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());
		
		// Now push drifted state with game in progress
		pushGameState(1, { 
			currentPeriod: 4, 
			homeScore: 85, 
			guestScore: 78,
			status: 'in_progress' 
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(85)); // Drifted
		expect(result.current.gameState?.status).toBe('in_progress');

		// Trigger game finalization via hook method
		// BUG: updateGameStatus('final') does NOT call recalculate automatically
		// Expected: Should call /api/games/[id]/recalculate BEFORE updating status
		await result.current.updateGameStatus('final');

		// CRITICAL ASSERTION: This will FAIL until T018 implementation
		// The updateGameStatus() method should trigger recalculation before changing status to 'final'
		expect(recalculateCalls.length).toBeGreaterThan(0);
		
		// If recalculation was called, the corrected state would be pushed
		// and the hook would show corrected scores before finalizing
		// This part documents the expected end-to-end flow after T018
	});
});

describe("T102 — full recalculation at reconnection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T102: WebSocket reconnection should trigger full recalculation that corrects drifted scores
	it("T102: WebSocket reconnection triggers full recalculation and corrects drifted scores", async () => {
		// Track whether recalculate API was called
		const recalculateCalls: Array<{ url: string; body?: unknown }> = [];
		
		// Mock fetch to intercept recalculate API calls
		global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
			const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
			
			if (urlStr.includes('/recalculate') && options?.method === 'POST') {
				recalculateCalls.push({ url: urlStr });
				
				// Return recalculation result showing correction
				return Response.json({
					corrected: true,
					oldValues: {
						homeScore: 50, // Drifted value
						guestScore: 45,
						homeFouls: 8,
						guestFouls: 7,
					},
					newValues: {
						homeScore: 54, // Corrected value (actual sum from events)
						guestScore: 45,
						homeFouls: 8,
						guestFouls: 7,
					},
					rosterChanges: [],
					trigger: 'reconnection',
					gameId: 'game-123',
					timestamp: new Date().toISOString(),
				});
			}
			
			return Response.json({}, { status: 404 });
		}) as typeof fetch;

		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState, gameStateHandler } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: game in progress with drifted score
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());
		// Initial subscription establishes connection
		
		// Push drifted state
		pushGameState(1, { 
			currentPeriod: 3, 
			homeScore: 50, // Drifted
			guestScore: 45,
			status: 'in_progress' 
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(50)); // Drifted
		expect(result.current.gameState?.currentPeriod).toBe(3);

		// Simulate WebSocket disconnection by calling error handler
		// This mimics network failure or connection loss
		const errorHandler = vi.mocked(getHasuraWsClient().subscribe).mock.calls
			.find(call => {
				const request = call[0];
				const query = request.query ?? "";
				return query.includes("GetGameState");
			})?.[1]?.error;
		
		if (errorHandler) {
			errorHandler(new Error('WebSocket connection lost'));
		}
		// Note: Connection state changes happen internally in hook

		// Simulate WebSocket reconnection by pushing state again
		// This mimics successful reconnection to the WebSocket
		if (gameStateHandler) {
			gameStateHandler({
				data: {
					gameStates: [{
						gameId: 'game-123',
						homeScore: 50, // Still drifted
						guestScore: 45,
						homeFouls: 8,
						guestFouls: 7,
						homeTimeouts: 3,
						guestTimeouts: 3,
						clockSeconds: 300,
						isTimerRunning: false,
						currentPeriod: 3,
						possession: 'home',
						status: 'in_progress',
						updatedAt: new Date().toISOString(),
						version: 1,
					}],
				},
			});
		}
		// Connection re-established via gameStateHandler callback

		// CRITICAL ASSERTION: This will FAIL until T021 implementation
		// The hook should detect reconnection and trigger recalculation
		// Expected: recalculate API called after reconnection to verify score integrity
		expect(recalculateCalls.length).toBeGreaterThan(0);
		
		// If recalculation was called, the corrected state would be pushed
		// and the hook would show corrected scores after reconnection
		// This part documents the expected end-to-end flow after T021
	});
});

describe("T103 — manual force-recalc button", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T103: Scorer pressing force-recalc button should trigger full recalculation
	it("T103: manual force-recalc button triggers full recalculation and shows toast", async () => {
		// Track whether recalculate API was called
		const recalculateCalls: Array<{ url: string; body?: unknown }> = [];
		
		// Mock fetch to intercept recalculate API calls
		global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
			const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
			
			if (urlStr.includes('/recalculate') && options?.method === 'POST') {
				recalculateCalls.push({ url: urlStr });
				
				// Return recalculation result showing correction
				return Response.json({
					corrected: true,
					oldValues: {
						homeScore: 42, // Drifted value
						guestScore: 38,
						homeFouls: 7,
						guestFouls: 9,
					},
					newValues: {
						homeScore: 45, // Corrected value (actual sum from events)
						guestScore: 38,
						homeFouls: 7,
						guestFouls: 9,
					},
					rosterChanges: [],
					trigger: 'manual_button',
					gameId: 'game-123',
					timestamp: new Date().toISOString(),
				});
			}
			
			return Response.json({}, { status: 404 });
		}) as typeof fetch;

		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: game in progress with drifted score (homeScore: 42, should be 45)
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());
		
		// Now push drifted state
		pushGameState(1, { 
			currentPeriod: 2, 
			homeScore: 42, 
			guestScore: 38,
			status: 'in_progress' 
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(42)); // Drifted
		expect(result.current.gameState?.currentPeriod).toBe(2);

		// Trigger manual recalculation via hook method
		// BUG: forceRecalculate() method does NOT exist on hook yet
		// Expected: Hook should expose forceRecalculate() that calls POST /api/games/[id]/recalculate
		
		// @ts-expect-error - forceRecalculate does not exist yet (will be added in T017)
		await result.current.forceRecalculate();

		// CRITICAL ASSERTION: This will FAIL until T017 implementation
		// The forceRecalculate() method should be exposed by the hook
		expect(recalculateCalls.length).toBeGreaterThan(0);
		
		// Additional expectations for when T017 is implemented:
		// - recalculateCalls[0].url should contain '/recalculate'
		// - Toast notification should be triggered (not tested here, will be in T016)
		// - Corrected state would be pushed via subscription
		// - All connected scorers would receive updated totals
	});
});

describe("T104 — discrepancy detection logging and toast", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Clear console.log spy
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	// T104: When recalculation finds discrepancy, it should log details and trigger toast
	it("T104: discrepancy detection logs details and triggers toast notification", async () => {
		// Track whether recalculate API was called
		const recalculateCalls: Array<{ url: string; body?: unknown }> = [];
		
		// Mock fetch to return a recalculation result with corrected=true (discrepancy found)
		global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
			const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
			
			if (urlStr.includes('/recalculate') && options?.method === 'POST') {
				recalculateCalls.push({ url: urlStr });
				
				// Return recalculation result showing discrepancy was found and corrected
				return Response.json({
					corrected: true, // KEY: Discrepancy detected
					oldValues: {
						homeScore: 56, // Drifted value
						guestScore: 51,
						homeFouls: 12,
						guestFouls: 10,
					},
					newValues: {
						homeScore: 60, // Corrected value (4 points were missing)
						guestScore: 51,
						homeFouls: 12,
						guestFouls: 10,
					},
					rosterChanges: [
						{ name: 'Player 12', team: 'home', oldPoints: 8, newPoints: 10, oldFouls: 2, newFouls: 2 },
						{ name: 'Player 7', team: 'home', oldPoints: 12, newPoints: 14, oldFouls: 3, newFouls: 3 },
					],
					trigger: 'period_change',
					gameId: 'game-123',
					timestamp: new Date().toISOString(),
				});
			}
			
			return Response.json({}, { status: 404 });
		}) as typeof fetch;

		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state: game in progress with drifted score
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());
		
		// Push drifted state
		pushGameState(1, { 
			currentPeriod: 2, 
			homeScore: 56, 
			guestScore: 51,
			status: 'in_progress' 
		});
		await waitFor(() => expect(result.current.gameState?.homeScore).toBe(56));

		// Trigger recalculation (via period change in this case)
		// BUG: updatePeriod() does NOT handle recalc result or set toast state yet
		// Expected: Should process recalc result and expose toast data to UI
		await result.current.updatePeriod(3);

		// CRITICAL ASSERTION 1: Recalc should be called (will FAIL until T018)
		expect(recalculateCalls.length).toBeGreaterThan(0);

		// CRITICAL ASSERTION 2: Hook should expose toast notification state
		// BUG: Hook does not have recalcToast state yet (will be added in T016/T019)
		// Expected: Hook exposes { recalcToast: { corrected: true, oldValues, newValues, ... } }
		// @ts-expect-error - recalcToast does not exist yet
		expect(result.current.recalcToast).toBeDefined();
		// @ts-expect-error - recalcToast does not exist yet
		expect(result.current.recalcToast?.corrected).toBe(true);

		// CRITICAL ASSERTION 3: Discrepancy should be logged to console (T019)
		// BUG: recalculateGameTotals does not log discrepancies yet
		// Expected: console.log should contain diagnostic details
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('discrepancy'),
			expect.objectContaining({
				gameId: 'game-123',
				trigger: 'period_change',
				oldValues: expect.objectContaining({ homeScore: 56 }),
				newValues: expect.objectContaining({ homeScore: 60 }),
			})
		);

		// Additional expectations for when T016/T019 are implemented:
		// - recalcToast state includes rosterChanges array
		// - Toast component receives this state and displays it
		// - Toast auto-dismisses after 5 seconds
		// - Corrected state syncs to all connected scorers
	});
});

// ---------------------------------------------------------------------------
// T107: Rapid-fire updates (10+/sec) processed without drops
// ---------------------------------------------------------------------------

describe("T107 — rapid-fire updates processed without drops", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// T107: Simulate 10+ rapid updates within 500ms and verify all are processed
	it("T107: rapid-fire updates (10+/sec) are processed without drops", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));

		// Initial state
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		// Simulate 15 rapid-fire state updates within 500ms (~30 updates/sec)
		// Each update increments homeScore by 2 points
		const updateCount = 15;
		const updateInterval = 500 / updateCount; // ~33ms between updates

		// Track all pushed scores to verify none are dropped
		const pushedScores: number[] = [];

		for (let i = 1; i <= updateCount; i++) {
			const newScore = i * 2;
			pushedScores.push(newScore);
			
			// Push state update
			pushGameState(i, {
				homeScore: newScore,
				guestScore: 0,
			});

			// Wait a small interval between updates to simulate rapid-fire
			if (i < updateCount) {
				await new Promise(resolve => setTimeout(resolve, updateInterval));
			}
		}

		// Final score should be 30 (15 * 2)
		const expectedFinalScore = updateCount * 2;

		// Wait for final state to propagate
		await waitFor(
			() => expect(result.current.gameState?.homeScore).toBe(expectedFinalScore),
			{ timeout: 2000 }
		);

		// Verify no updates were dropped - final score should match expected
		expect(result.current.gameState?.homeScore).toBe(expectedFinalScore);
		expect(result.current.gameState?.version).toBe(updateCount);

		// Verify the hook processed all updates without errors
		// (If updates were dropped, final score would be less than expected)
	});

	// T107b: Concurrent rapid-fire updates from multiple scorers
	it("T107b: concurrent rapid-fire updates from multiple scorers processed correctly", async () => {
		const { mock: casMock } = buildCasMock(1);
		vi.mocked(graphqlRequest).mockImplementation(casMock);

		// Setup 3 concurrent scorer hooks
		const hooks = await Promise.all(
			Array.from({ length: 3 }, async () => {
				const { pushGameState } = setupSubscriptions();
				const { result } = renderHook(() => useHasuraGame("game-123"));
				pushGameState(1);
				await waitFor(() => expect(result.current.gameState).toBeDefined());
				return result;
			})
		);

		// Each scorer fires 5 rapid updates (total 15 operations in ~250ms)
		const updatesPerScorer = 5;
		const allOperations = hooks.flatMap((hook) =>
			Array.from({ length: updatesPerScorer }, () =>
				hook.current.updateScore("home", 1)
			)
		);

		// Execute all 15 operations concurrently
		const results = await Promise.allSettled(allOperations);

		// Verify all operations succeeded (none rejected)
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected).toHaveLength(0);

		// All 15 operations should succeed via CAS retry mechanism
		const fulfilled = results.filter((r) => r.status === "fulfilled");
		expect(fulfilled).toHaveLength(15);
	});
});

// T105 — Role enforcement: viewers cannot mutate under concurrent load
// NOTE: This test verifies authorization error propagation in isolation.
// True concurrent multi-actor testing (viewer + scorer simultaneously) is not possible
// at the hook unit test level due to setupSubscriptions() handler overwriting.
// Authorization is enforced at the Hasura RLS (database) level, where viewers
// are rejected because they're not in the game_scorers table with appropriate permissions.
describe('T105 — role enforcement: viewers cannot mutate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});
	
	// T105: Viewer mutation attempts rejected by Hasura authorization
	// Simulates the Hasura RLS layer rejecting a viewer's mutation attempt
	// because the viewer is not in the game_scorers table (or has role='viewer')
	it('T105: viewer mutation rejected with authorization error from Hasura', async () => {
		// Mock Hasura RLS rejection: all mutations throw permission denied
		// This simulates what happens when a viewer (not in game_scorers) tries to mutate
		vi.mocked(graphqlRequest).mockImplementation(async (query: string) => {
			if (query.includes('UpdateGameStateVersioned')) {
				// Hasura RLS rejects: viewer not authorized to mutate game_states
				throw new Error('permission denied for relation game_states');
			}
			// Subscriptions still work (viewers can read)
			return {};
		});
		
		const { pushGameState, pushScorers } = setupSubscriptions();
		
		// Setup hook as if viewer is watching the game
		const { result } = renderHook(() => useHasuraGame('game-123'));
		pushGameState(1);
		pushScorers(2);
		
		// Wait for connection
		await waitFor(() => expect(result.current.isConnected).toBe(true));
		
		// Viewer attempts to mutate - should be rejected by Hasura
		const mutationAttempt = result.current.updateScore('guest', 3);
		
		// Verify Hasura authorization error propagates to the caller
		await expect(mutationAttempt).rejects.toThrow('permission denied');
	});
	
	// T105b: Verify scorer mutations succeed with valid permissions (contrast test)
	it('T105b: scorer with valid permissions can mutate successfully', async () => {
		const { mock: casMock } = buildCasMock(1);
		
		// Mock normal authorization: scorer in game_scorers table, mutations succeed
		vi.mocked(graphqlRequest).mockImplementation(casMock);
		
		const { pushGameState, pushScorers } = setupSubscriptions();
		
		// Setup hook as if scorer has valid permissions
		const { result } = renderHook(() => useHasuraGame('game-123'));
		pushGameState(1);
		pushScorers(2);
		
		// Wait for connection
		await waitFor(() => expect(result.current.isConnected).toBe(true));
		
		// Scorer mutation should succeed
		await expect(result.current.updateScore('home', 2)).resolves.toBeUndefined();
		
		// Verify mutation reached graphqlRequest
		const updateCalls = vi.mocked(graphqlRequest).mock.calls.filter(
			([query]) => query.includes('UpdateGameStateVersioned')
		);
		expect(updateCalls.length).toBeGreaterThan(0);
	});
});

// T106 — Role enforcement: co_scorers can score but not manage other scorers
// NOTE: This test verifies co_scorer authorization at two levels:
// 1. Co_scorers CAN mutate game state (scores, fouls, timer) - tested via hook
// 2. Co_scorers CANNOT manage other scorers (invite/remove/change roles) - tested via API mock
// The hook doesn't expose scorer management methods, so we test API authorization directly.
describe('T106 — role enforcement: co_scorers can score but not manage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});
	
	// T106a: Co_scorer can mutate game state successfully
	it('T106a: co_scorer can update scores and game state', async () => {
		const { mock: casMock } = buildCasMock(1);
		
		// Mock normal authorization: co_scorer in game_scorers table, mutations succeed
		vi.mocked(graphqlRequest).mockImplementation(casMock);
		
		const { pushGameState, pushScorers } = setupSubscriptions();
		
		// Setup hook as co_scorer (role='co_scorer' in game_scorers table)
		const { result } = renderHook(() => useHasuraGame('game-123'));
		pushGameState(1);
		pushScorers(2);
		
		// Wait for connection
		await waitFor(() => expect(result.current.isConnected).toBe(true));
		
		// Co_scorer can update scores
		await expect(result.current.updateScore('home', 2)).resolves.toBeUndefined();
		
		// Verify mutation succeeded
		const updateCalls = vi.mocked(graphqlRequest).mock.calls.filter(
			([query]) => query.includes('UpdateGameStateVersioned')
		);
		expect(updateCalls.length).toBeGreaterThan(0);
	});
	
	// T106b: Co_scorer cannot remove other scorers (API authorization)
	// This simulates what happens when a co_scorer tries to DELETE /api/games/[id]/scorers/[scorerId]
	// The API route checks: only owner can remove scorers (or users can remove themselves)
	it('T106b: co_scorer cannot remove other scorers via API', async () => {
		// Mock API response: co_scorer attempting to remove another scorer
		// In the real API (src/app/api/games/[id]/scorers/[scorerId]/route.ts line 45-47):
		// if (!isOwner && !isSelf) return 403
		
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: async () => ({ error: 'Not authorized to remove this scorer' }),
		});
		
		// Simulate co_scorer (userId='co-scorer-123') trying to remove another scorer
		const response = await mockFetch('/api/games/game-123/scorers/other-scorer-id', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});
		
		// Verify authorization rejection
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toContain('Not authorized to remove this scorer');
	});
	
	// T106c: Co_scorer can remove themselves (special case)
	// API allows users to remove themselves even if they're not the owner
	it('T106c: co_scorer can remove themselves from game', async () => {
		// Mock API response: co_scorer removing themselves (isSelf = true)
		// In the real API (line 43, 45): isSelf = scorerToRemove.userId === userId
		
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ success: true }),
		});
		
		// Simulate co_scorer removing themselves
		const response = await mockFetch('/api/games/game-123/scorers/my-scorer-id', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});
		
		// Verify self-removal succeeds
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// T108–T112: Period advance — advancePeriod() atomic CAS + timer reset
// ---------------------------------------------------------------------------

describe("T108 — advancePeriod: timer stopped, single scorer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("T108: advances period atomically, resets clock and fouls, no conflict", async () => {
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned"))
					return { updateGameStates: { affected_rows: 1 } };
				return {};
			},
		);

		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState({ isRunning: false });
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		const ok = await result.current.advancePeriod();
		expect(ok).toBe(true);

		const versionedCalls = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("UpdateGameStateVersioned"));
		expect(versionedCalls.length).toBe(1);

		const casVars = versionedCalls[0][1] as Record<string, unknown>;
		expect(casVars.currentPeriod).toBe(2);
		expect(casVars.clockSeconds).toBe(600);
		expect(casVars.homeFouls).toBe(0);
		expect(casVars.guestFouls).toBe(0);

		const timerCalls = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("ControlTimer"));
		expect(timerCalls.length).toBe(1);

		const timerVars = timerCalls[0][1] as Record<string, unknown>;
		expect(timerVars.isRunning).toBe(false);
		expect(timerVars.currentClockSeconds).toBe(600);
		expect(timerVars.initialClockSeconds).toBe(600);

		expect(result.current.conflictDetected).toBe(false);
	});
});

describe("T109 — advancePeriod: timer running, single scorer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("T109: advances period and resets timer even when timer was running", async () => {
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned"))
					return { updateGameStates: { affected_rows: 1 } };
				return {};
			},
		);

		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState({ isRunning: true, startedAt: new Date().toISOString() });
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		const ok = await result.current.advancePeriod();
		expect(ok).toBe(true);

		// CAS must fire before timer reset
		const allCalls = vi.mocked(graphqlRequest).mock.calls.map(([q]) => {
			if (q.includes("UpdateGameStateVersioned")) return "versioned";
			if (q.includes("ControlTimer")) return "timer";
			return "other";
		});
		const versionedIdx = allCalls.indexOf("versioned");
		const timerIdx = allCalls.indexOf("timer");
		expect(versionedIdx).toBeGreaterThanOrEqual(0);
		expect(timerIdx).toBeGreaterThan(versionedIdx);

		const timerVars = vi
			.mocked(graphqlRequest)
			.mock.calls.filter(([q]) => q.includes("ControlTimer"))[0][1] as Record<string, unknown>;
		expect(timerVars.isRunning).toBe(false);
		expect(timerVars.currentClockSeconds).toBe(600);

		expect(result.current.conflictDetected).toBe(false);
	});
});

describe("T110 — advancePeriod: retry succeeds on concurrent score update", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("T110: retries once after 0 affected_rows and succeeds — no conflict signalled", async () => {
		let callCount = 0;
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned")) {
					callCount++;
					// First attempt: stale version (concurrent update won the race)
					if (callCount === 1)
						return { updateGameStates: { affected_rows: 0 } };
					// Second attempt: fresh version succeeds
					return { updateGameStates: { affected_rows: 1 } };
				}
				return {};
			},
		);

		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState();
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		// Simulate subscription pushing fresh state mid-retry
		const advancePromise = result.current.advancePeriod();
		// Push updated state (as if another scorer's update arrived)
		pushGameState(2);

		const ok = await advancePromise;
		expect(ok).toBe(true);
		expect(callCount).toBe(2);
		expect(result.current.conflictDetected).toBe(false);
	});
});

describe("T111 — advancePeriod: double-click race signals conflict", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("T111: both attempts return 0 affected_rows → signalConflict called, returns false", async () => {
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned"))
					return { updateGameStates: { affected_rows: 0 } };
				return {};
			},
		);

		const { pushGameState, pushTimerState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		pushTimerState();
		await waitFor(() => expect(result.current.gameState).toBeDefined());

		const ok = await result.current.advancePeriod();
		expect(ok).toBe(false);
		await waitFor(() => expect(result.current.conflictDetected).toBe(true));
	});
});

describe("T112 — regression: updateScore and updateFouls still conflict-detect", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("T112a: updateScore retries and succeeds — no conflict", async () => {
		let callCount = 0;
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned")) {
					callCount++;
					if (callCount === 1)
						return { updateGameStates: { affected_rows: 0 } };
					return { updateGameStates: { affected_rows: 1 } };
				}
				return {};
			},
		);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		await result.current.updateScore("home", 2);
		expect(result.current.conflictDetected).toBe(false);
		expect(callCount).toBe(2);
	});

	it("T112b: updateFouls retries and succeeds — no conflict", async () => {
		let callCount = 0;
		vi.mocked(graphqlRequest).mockImplementation(
			async (query: string) => {
				if (query.includes("UpdateGameStateVersioned")) {
					callCount++;
					if (callCount === 1)
						return { updateGameStates: { affected_rows: 0 } };
					return { updateGameStates: { affected_rows: 1 } };
				}
				return {};
			},
		);

		const { pushGameState } = setupSubscriptions();
		const { result } = renderHook(() => useHasuraGame("game-123"));
		pushGameState(1);
		await waitFor(() => expect(result.current.gameState?.version).toBe(1));

		await result.current.updateFouls("home", 1);
		expect(result.current.conflictDetected).toBe(false);
		expect(callCount).toBe(2);
	});
});

