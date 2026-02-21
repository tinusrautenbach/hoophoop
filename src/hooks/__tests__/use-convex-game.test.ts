import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ConvexProvider } from "convex/react";
import { useConvexGame } from "../use-convex-game";
import { ReactNode } from "react";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => mockUseMutation(),
  };
});

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: "test-user-id" }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <ConvexProvider client={{} as any}>{children}</ConvexProvider>;
}

describe("useConvexGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  it("should return game state from Convex query", () => {
    const mockGameState = {
      gameId: "game-123",
      homeScore: 10,
      guestScore: 8,
      homeFouls: 2,
      guestFouls: 1,
      clockSeconds: 480,
      isTimerRunning: true,
      currentPeriod: 1,
      status: "live",
    };

    mockUseQuery.mockReturnValue(mockGameState);

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    expect(result.current.gameState).toEqual(mockGameState);
    expect(result.current.isConnected).toBe(true);
  });

  it("should return undefined when game state is loading", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    expect(result.current.gameState).toBeUndefined();
    expect(result.current.isConnected).toBe(false);
  });

  it("should calculate current clock correctly when timer is running", () => {
    const now = Date.now();
    mockUseQuery
      .mockReturnValueOnce({
        gameId: "game-123",
        homeScore: 10,
        guestScore: 8,
        clockSeconds: 600,
        isTimerRunning: true,
        timerStartedAt: now - 5000,
      })
      .mockReturnValueOnce({
        gameId: "game-123",
        isRunning: true,
        startedAt: now - 5000,
        initialClockSeconds: 600,
        currentClockSeconds: 595,
      });

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    expect(result.current.currentClock).toBeLessThanOrEqual(595);
    expect(result.current.currentClock).toBeGreaterThan(590);
  });

  it("should provide updateScore mutation", async () => {
    const mockGameState = {
      gameId: "game-123",
      homeScore: 10,
      guestScore: 8,
    };

    mockUseQuery.mockReturnValue(mockGameState);

    const updateGameStateMock = vi.fn().mockResolvedValue({ success: true });
    mockUseMutation.mockReturnValue(updateGameStateMock);

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    await result.current.updateScore("home", 2);

    await waitFor(() => {
      expect(updateGameStateMock).toHaveBeenCalledWith({
        gameId: "game-123",
        updates: { homeScore: 12 },
      });
    });
  });

  it("should provide timer control mutations", async () => {
    mockUseQuery.mockReturnValue({
      gameId: "game-123",
      clockSeconds: 600,
      isTimerRunning: false,
    });

    const controlTimerMock = vi.fn().mockResolvedValue({ success: true });
    mockUseMutation.mockReturnValue(controlTimerMock);

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    await result.current.startTimer();

    await waitFor(() => {
      expect(controlTimerMock).toHaveBeenCalledWith({
        gameId: "game-123",
        action: "start",
        clockSeconds: 600,
      });
    });
  });

  it("should provide addEvent mutation", async () => {
    mockUseQuery.mockReturnValue({ gameId: "game-123" });

    const addGameEventMock = vi.fn().mockResolvedValue({ success: true });
    mockUseMutation.mockReturnValue(addGameEventMock);

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    const event = {
      type: "score" as const,
      period: 1,
      clockAt: 600,
      team: "home" as const,
      player: "Player 1",
      value: 2,
      description: "Player 1 scored 2 points",
    };

    await result.current.addEvent(event);

    await waitFor(() => {
      expect(addGameEventMock).toHaveBeenCalled();
    });
  });

  it("should handle game events array", () => {
    const mockEvents = [
      {
        _id: "event-1",
        gameId: "game-123",
        type: "score",
        description: "Player 1 scored",
        createdAt: Date.now(),
      },
      {
        _id: "event-2",
        gameId: "game-123",
        type: "foul",
        description: "Player 2 fouled",
        createdAt: Date.now() - 1000,
      },
    ];

    mockUseQuery.mockImplementation((query: any) => {
      if (query.toString().includes("getGameEvents")) {
        return mockEvents;
      }
      return { gameId: "game-123" };
    });

    const { result } = renderHook(() => useConvexGame("game-123"), {
      wrapper: Wrapper,
    });

    expect(result.current.gameEvents).toEqual(mockEvents);
  });
});
