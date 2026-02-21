import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '@clerk/nextjs';

interface GameState {
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
}

interface GameEvent {
  _id: Id<'gameEvents'>;
  gameId: Id<'games'>;
  type: string;
  period: number;
  clockAt: number;
  team?: 'home' | 'guest';
  player?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  description: string;
  createdAt: number;
}

export function useConvexGame(gameId: string) {
  const { userId } = useAuth();
  const clientId = useRef(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const convexGameId = gameId as Id<'games'>;

  const gameState = useQuery(api.games.getGameState, { gameId: convexGameId });
  const gameEvents = useQuery(api.games.getGameEvents, { gameId: convexGameId, limit: 100 });
  const timerState = useQuery(api.games.getTimerState, { gameId: convexGameId });
  const presence = useQuery(api.games.getGamePresence, { gameId: convexGameId });

  const updateGameState = useMutation(api.games.updateGameState);
  const addGameEvent = useMutation(api.games.addGameEvent);
  const controlTimer = useMutation(api.games.controlTimer);
  const joinGame = useMutation(api.games.joinGame);
  const leaveGame = useMutation(api.games.leaveGame);
  const deleteGameEvent = useMutation(api.games.deleteGameEvent);

  useEffect(() => {
    if (userId) {
      joinGame({
        gameId: convexGameId,
        role: 'spectator',
        clientId: clientId.current,
      });
    }

    return () => {
      if (userId) {
        leaveGame({ gameId: convexGameId });
      }
    };
  }, [userId, convexGameId, joinGame, leaveGame]);

  const updateScore = useCallback(
    async (team: 'home' | 'guest', points: number) => {
      const updates: Partial<GameState> =
        team === 'home'
          ? { homeScore: (gameState?.homeScore ?? 0) + points }
          : { guestScore: (gameState?.guestScore ?? 0) + points };

      await updateGameState({
        gameId: convexGameId,
        updates,
      });
    },
    [gameState, updateGameState, convexGameId]
  );

  const updateFouls = useCallback(
    async (team: 'home' | 'guest', fouls: number) => {
      const updates: Partial<GameState> =
        team === 'home' ? { homeFouls: fouls } : { guestFouls: fouls };

      await updateGameState({
        gameId: convexGameId,
        updates,
      });
    },
    [updateGameState, convexGameId]
  );

  const updateTimeouts = useCallback(
    async (team: 'home' | 'guest', timeouts: number) => {
      const updates: Partial<GameState> =
        team === 'home' ? { homeTimeouts: timeouts } : { guestTimeouts: timeouts };

      await updateGameState({
        gameId: convexGameId,
        updates,
      });
    },
    [updateGameState, convexGameId]
  );

  const updateClock = useCallback(
    async (clockSeconds: number) => {
      await updateGameState({
        gameId: convexGameId,
        updates: { clockSeconds },
      });
    },
    [updateGameState, convexGameId]
  );

  const updatePeriod = useCallback(
    async (currentPeriod: number) => {
      await updateGameState({
        gameId: convexGameId,
        updates: { currentPeriod },
      });
    },
    [updateGameState, convexGameId]
  );

  const updatePossession = useCallback(
    async (possession: 'home' | 'guest') => {
      await updateGameState({
        gameId: convexGameId,
        updates: { possession },
      });
    },
    [updateGameState, convexGameId]
  );

  const updateGameStatus = useCallback(
    async (status: 'scheduled' | 'live' | 'final') => {
      await updateGameState({
        gameId: convexGameId,
        updates: { status },
      });
    },
    [updateGameState, convexGameId]
  );

  const startTimer = useCallback(async () => {
    await controlTimer({
      gameId: convexGameId,
      action: 'start',
      clockSeconds: gameState?.clockSeconds,
    });
  }, [controlTimer, convexGameId, gameState?.clockSeconds]);

  const stopTimer = useCallback(async () => {
    await controlTimer({
      gameId: convexGameId,
      action: 'stop',
    });
  }, [controlTimer, convexGameId]);

  const addEvent = useCallback(
    async (event: Omit<GameEvent, '_id' | 'gameId' | 'createdAt'>) => {
      await addGameEvent({
        gameId: convexGameId,
        event: {
          ...event,
          eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      });
    },
    [addGameEvent, convexGameId]
  );

  const removeEvent = useCallback(
    async (eventId: Id<'gameEvents'>) => {
      await deleteGameEvent({ eventId });
    },
    [deleteGameEvent]
  );

  const calculateCurrentClock = useCallback(() => {
    if (!timerState?.isRunning || !timerState.startedAt) {
      return timerState?.currentClockSeconds ?? gameState?.clockSeconds ?? 600;
    }

    const elapsedMs = Date.now() - timerState.startedAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const currentClock = (timerState.initialClockSeconds ?? 600) - elapsedSeconds;

    return Math.max(0, currentClock);
  }, [timerState, gameState?.clockSeconds]);

  return {
    gameState,
    gameEvents,
    timerState,
    presence,
    isConnected: !!gameState,
    currentClock: calculateCurrentClock(),
    isTimerRunning: timerState?.isRunning ?? false,
    updateScore,
    updateFouls,
    updateTimeouts,
    updateClock,
    updatePeriod,
    updatePossession,
    updateGameStatus,
    startTimer,
    stopTimer,
    addEvent,
    removeEvent,
    joinAsScorer: useCallback(
      () => joinGame({ gameId: convexGameId, role: 'scorer', clientId: clientId.current }),
      [joinGame, convexGameId]
    ),
  };
}
