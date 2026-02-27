import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getHasuraWsClient, graphqlRequest, closeHasuraConnection } from '@/lib/hasura/client';
import type { Client, ExecutionResult } from 'graphql-ws';

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
  version: number;
}

interface GameEvent {
  _id: string;
  gameId: string;
  type: string;
  period: number;
  clockAt: number;
  team?: 'home' | 'guest';
  player?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  description: string;
  createdAt: number;
  createdBy?: string;
}

interface TimerState {
  isRunning: boolean;
  startedAt?: number;
  initialClockSeconds: number;
  currentClockSeconds: number;
}

interface ScorerPresence {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  lastActiveAt: string;
}

const UPDATE_CLOCK_MUTATION = `
  mutation UpdateClock($gameId: uuid!, $clockSeconds: Int!, $updatedAt: timestamptz!, $updatedBy: String!) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        clockSeconds: $clockSeconds
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [clockSeconds, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

const UPDATE_PERIOD_MUTATION = `
  mutation UpdatePeriod($gameId: uuid!, $currentPeriod: Int!, $updatedAt: timestamptz!, $updatedBy: String!) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        currentPeriod: $currentPeriod
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [currentPeriod, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

const UPDATE_POSSESSION_MUTATION = `
  mutation UpdatePossession($gameId: uuid!, $possession: String!, $updatedAt: timestamptz!, $updatedBy: String!) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        possession: $possession
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [possession, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

const UPDATE_STATUS_MUTATION = `
  mutation UpdateGameStatus($gameId: uuid!, $status: String!, $updatedAt: timestamptz!, $updatedBy: String!) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        status: $status
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [status, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

// Version-checked update — returns affected_rows (0 = conflict, stale version)
const UPDATE_GAME_STATE_VERSIONED_MUTATION = `
  mutation UpdateGameStateVersioned(
    $gameId: uuid!
    $homeScore: Int
    $guestScore: Int
    $homeFouls: Int
    $guestFouls: Int
    $homeTimeouts: Int
    $guestTimeouts: Int
    $clockSeconds: Int
    $currentPeriod: Int
    $possession: String
    $status: String
    $isTimerRunning: Boolean
    $expectedVersion: Int!
    $updatedAt: timestamptz!
    $updatedBy: String!
  ) {
    update_game_states(
      where: {
        gameId: { _eq: $gameId }
        version: { _eq: $expectedVersion }
      }
      _set: {
        homeScore: $homeScore
        guestScore: $guestScore
        homeFouls: $homeFouls
        guestFouls: $guestFouls
        homeTimeouts: $homeTimeouts
        guestTimeouts: $guestTimeouts
        clockSeconds: $clockSeconds
        currentPeriod: $currentPeriod
        possession: $possession
        status: $status
        isTimerRunning: $isTimerRunning
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      _inc: { version: 1 }
    ) {
      affected_rows
    }
  }
`;

// Blind upsert — used only for initGameState (first-time insert, no conflict possible)
const INIT_GAME_STATE_MUTATION = `
  mutation InitGameState(
    $gameId: uuid!
    $homeScore: Int
    $guestScore: Int
    $homeFouls: Int
    $guestFouls: Int
    $homeTimeouts: Int
    $guestTimeouts: Int
    $clockSeconds: Int
    $currentPeriod: Int
    $possession: String
    $status: String
    $isTimerRunning: Boolean
    $updatedAt: timestamptz
    $updatedBy: String
  ) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        homeScore: $homeScore
        guestScore: $guestScore
        homeFouls: $homeFouls
        guestFouls: $guestFouls
        homeTimeouts: $homeTimeouts
        guestTimeouts: $guestTimeouts
        clockSeconds: $clockSeconds
        currentPeriod: $currentPeriod
        possession: $possession
        status: $status
        isTimerRunning: $isTimerRunning
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [homeScore, guestScore, homeFouls, guestFouls, homeTimeouts, guestTimeouts, clockSeconds, currentPeriod, possession, status, isTimerRunning, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

const ADD_GAME_EVENT_MUTATION = `
  mutation AddGameEvent(
    $gameId: uuid!
    $eventId: String
    $type: String!
    $period: Int!
    $clockAt: Int!
    $team: String
    $player: String
    $value: Int
    $metadata: jsonb
    $description: String!
    $createdAt: timestamptz
    $createdBy: String
  ) {
    insert_hasura_game_events_one(
      object: {
        game_id: $gameId
        event_id: $eventId
        type: $type
        period: $period
        clock_at: $clockAt
        team: $team
        player: $player
        value: $value
        metadata: $metadata
        description: $description
        created_at: $createdAt
        created_by: $createdBy
      }
    ) {
      id
    }
  }
`;

const DELETE_GAME_EVENT_MUTATION = `
  mutation DeleteGameEvent($eventId: uuid!) {
    delete_hasura_game_events_by_pk(id: $eventId) {
      id
    }
  }
`;

const UPSERT_SCORER_PRESENCE = `
  mutation UpsertScorerPresence($gameId: uuid!, $userId: String!, $lastActiveAt: timestamptz!) {
    update_game_scorers(
      where: { game_id: { _eq: $gameId }, user_id: { _eq: $userId } }
      _set: { last_active_at: $lastActiveAt }
    ) {
      affected_rows
    }
  }
`;

const CONTROL_TIMER_MUTATION = `
  mutation ControlTimer(
    $gameId: uuid!
    $isRunning: Boolean!
    $startedAt: timestamptz
    $initialClockSeconds: Int!
    $currentClockSeconds: Int!
    $updatedAt: timestamptz!
    $updatedBy: String!
  ) {
    insertTimerSyncOne(
      object: {
        gameId: $gameId
        isRunning: $isRunning
        startedAt: $startedAt
        initialClockSeconds: $initialClockSeconds
        currentClockSeconds: $currentClockSeconds
        updatedAt: $updatedAt
        updatedBy: $updatedBy
      }
      on_conflict: {
        constraint: timer_sync_pkey
        update_columns: [isRunning, startedAt, initialClockSeconds, currentClockSeconds, updatedAt, updatedBy]
      }
    ) {
      gameId
    }
  }
`;

export function useHasuraGame(gameId: string) {
  const { userId } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const unsubscribeRef = useRef<{ gameState?: () => void; events?: () => void; timer?: () => void; scorers?: () => void }>({});

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hasura_game_events, setGameEvents] = useState<GameEvent[]>([]);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeScorers, setActiveScorers] = useState<ScorerPresence[]>([]);
  const [conflictDetected, setConflictDetected] = useState(false);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Get the graphql-ws client
    const client = getHasuraWsClient();
    clientRef.current = client;

    // Subscribe to game state changes
    const gameStateUnsubscribe = client.subscribe<
      { gameStates: Array<{
        gameId: string;
        homeScore: number;
        guestScore: number;
        homeFouls: number;
        guestFouls: number;
        homeTimeouts: number;
        guestTimeouts: number;
        clockSeconds: number;
        isTimerRunning: boolean;
        currentPeriod: number;
        possession: string;
        status: string;
        updatedAt: string;
        version: number;
      }> }
    >(
      {
        query: `
          subscription GetGameState($gameId: uuid!) {
            gameStates(where: { gameId: { _eq: $gameId } }) {
              gameId
              homeScore
              guestScore
              homeFouls
              guestFouls
              homeTimeouts
              guestTimeouts
              clockSeconds
              isTimerRunning
              currentPeriod
              possession
              status
              updatedAt
              version
            }
          }
        `,
        variables: { gameId },
      },
      {
        next: (result) => {
          setIsConnected(true);
          const states = result.data?.gameStates;
          if (states && states.length > 0) {
            const state = states[0];
            setGameState({
              homeScore: (state.homeScore as number) ?? 0,
              guestScore: (state.guestScore as number) ?? 0,
              homeFouls: (state.homeFouls as number) ?? 0,
              guestFouls: (state.guestFouls as number) ?? 0,
              homeTimeouts: (state.homeTimeouts as number) ?? 3,
              guestTimeouts: (state.guestTimeouts as number) ?? 3,
              clockSeconds: (state.clockSeconds as number) ?? 600,
              isTimerRunning: (state.isTimerRunning as boolean) ?? false,
              currentPeriod: (state.currentPeriod as number) ?? 1,
              possession: state.possession as 'home' | 'guest' | undefined,
              status: (state.status as 'scheduled' | 'live' | 'final') || 'scheduled',
              version: (state.version as number) ?? 1,
            });
          }
        },
        error: (err: Error) => {
          console.error('[Hasura] Game state subscription error:', err);
          setIsConnected(false);
        },
        complete: () => {
          console.log('[Hasura] Game state subscription completed');
          setIsConnected(false);
        },
      }
    );
    unsubscribeRef.current.gameState = gameStateUnsubscribe;

    // Subscribe to game events
    const eventsUnsubscribe = client.subscribe<
      { hasura_game_events: Array<{
        id: string;
        game_id: string;
        type: string;
        period: number;
        clock_at: number;
        team: string;
        player: string;
        value: number;
        metadata: Record<string, unknown>;
        description: string;
        created_at: string;
        created_by: string;
      }> }
    >(
      {
        query: `
          subscription GetGameEvents($gameId: uuid!) {
            hasura_game_events(where: { game_id: { _eq: $gameId } }, order_by: { created_at: desc }, limit: 100) {
              id
              game_id
              type
              period
              clock_at
              team
              player
              value
              metadata
              description
              created_by
              created_at
            }
          }
        `,
        variables: { gameId },
      },
      {
        next: (result) => {
          const events = result.data?.hasura_game_events;
          if (events) {
            const mappedEvents = events.map((e) => ({
              _id: e.id as string,
              gameId: e.game_id as string,
              type: e.type as string,
              period: e.period as number,
              clockAt: e.clock_at as number,
              team: e.team as 'home' | 'guest' | undefined,
              player: e.player as string,
              value: e.value as number,
              metadata: e.metadata as Record<string, unknown>,
              description: e.description as string,
              createdAt: new Date(e.created_at as string).getTime(),
              createdBy: e.created_by as string | undefined,
            }));
            setGameEvents(mappedEvents.reverse());
          }
        },
        error: (err: Error | unknown) => {
          console.error('[Hasura] Game events subscription error:', err);
          console.error('Query:', 'subscription GetGameEvents($gameId: uuid!) { hasura_game_events(...) }');
          if (Array.isArray(err)) {
            err.forEach((e, i) => {
              console.error(`  Error ${i}:`, e);
              if (e && typeof e === 'object' && 'message' in e) {
                console.error(`    Message: ${(e as {message: string}).message}`);
              }
            });
          }
        },
        complete: () => {
          console.log('[Hasura] Game events subscription completed');
        },
      }
    );
    unsubscribeRef.current.events = eventsUnsubscribe;

    // Subscribe to timer state
    const timerUnsubscribe = client.subscribe<
      { timerSync: Array<{
        gameId: string;
        isRunning: boolean;
        startedAt: string;
        initialClockSeconds: number;
        currentClockSeconds: number;
        updatedAt: string;
      }> }
    >(
      {
        query: `
          subscription GetTimerState($gameId: uuid!) {
            timerSync(where: { gameId: { _eq: $gameId } }) {
              gameId
              isRunning
              startedAt
              initialClockSeconds
              currentClockSeconds
              updatedAt
            }
          }
        `,
        variables: { gameId },
      },
      {
        next: (result) => {
          const timers = result.data?.timerSync;
          if (timers && timers.length > 0) {
            const timer = timers[0];
            setTimerState({
              isRunning: timer.isRunning as boolean,
              startedAt: timer.startedAt ? new Date(timer.startedAt as string).getTime() : undefined,
              initialClockSeconds: timer.initialClockSeconds as number,
              currentClockSeconds: timer.currentClockSeconds as number,
            });
          }
        },
        error: (err: Error) => {
          console.error('[Hasura] Timer subscription error:', err);
        },
        complete: () => {
          console.log('[Hasura] Timer subscription completed');
        },
      }
    );
    unsubscribeRef.current.timer = timerUnsubscribe;

    // Subscribe to scorer presence
    const scorersUnsubscribe = client.subscribe<
      { game_scorers: Array<{
        id: string;
        user_id: string;
        role: string;
        joined_at: string;
        last_active_at: string;
      }> }
    >(
      {
        query: `
          subscription GetGameScorers($gameId: uuid!) {
            game_scorers(where: { game_id: { _eq: $gameId } }) {
              id
              user_id
              role
              joined_at
              last_active_at
            }
          }
        `,
        variables: { gameId },
      },
      {
        next: (result) => {
          const scorerRows = result.data?.game_scorers;
          if (scorerRows) {
            setActiveScorers(scorerRows.map((s) => ({
              id: s.id as string,
              userId: s.user_id as string,
              role: s.role as string,
              joinedAt: s.joined_at as string,
              lastActiveAt: s.last_active_at as string,
            })));
          }
        },
        error: (err: Error) => {
          console.error('[Hasura] Scorers subscription error:', err);
        },
        complete: () => {
          console.log('[Hasura] Scorers subscription completed');
        },
      }
    );
    unsubscribeRef.current.scorers = scorersUnsubscribe;

    return () => {
      // Unsubscribe from all subscriptions
      Object.values(unsubscribeRef.current).forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
      if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    };
  }, [gameId]);

  // Helper: signal a conflict and auto-clear after 5s
  const signalConflict = useCallback(() => {
    setConflictDetected(true);
    if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    conflictTimerRef.current = setTimeout(() => setConflictDetected(false), 5000);
  }, []);

  // Version-aware update helper: attempts once with the current version, retries once on conflict.
  // Returns true if the update succeeded, false if it ultimately failed (conflict persists).
  const versionedUpdate = useCallback(async (
    buildUpdates: (state: GameState) => Partial<GameState>,
    maxRetries = 1,
  ): Promise<boolean> => {
    let attempt = 0;
    let currentState = gameState;
    while (attempt <= maxRetries) {
      if (!currentState) return false;
      const updates = buildUpdates(currentState);
      const now = new Date().toISOString();
      const result = await graphqlRequest<{ update_game_states: { affected_rows: number } }>(
        UPDATE_GAME_STATE_VERSIONED_MUTATION,
        {
          gameId,
          ...currentState,
          ...updates,
          expectedVersion: currentState.version,
          updatedAt: now,
          updatedBy: userId || 'anonymous',
        },
      );
      const affected = result?.update_game_states?.affected_rows ?? 0;
      if (affected > 0) return true;
      // Conflict: wait briefly for subscription to deliver fresh state, then retry
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        currentState = gameState; // re-read latest from subscription
      }
    }
    signalConflict();
    return false;
  }, [gameState, gameId, userId, signalConflict]);

  const updateScore = useCallback(async (team: 'home' | 'guest', points: number) => {
    await versionedUpdate((state) =>
      team === 'home'
        ? { homeScore: state.homeScore + points }
        : { guestScore: state.guestScore + points },
    );
  }, [versionedUpdate]);

  const updateFouls = useCallback(async (team: 'home' | 'guest', fouls: number) => {
    await versionedUpdate((state) =>
      team === 'home' ? { homeFouls: fouls } : { guestFouls: fouls },
    );
  }, [versionedUpdate]);

  const updateTimeouts = useCallback(async (team: 'home' | 'guest', timeouts: number) => {
    await versionedUpdate((state) =>
      team === 'home' ? { homeTimeouts: timeouts } : { guestTimeouts: timeouts },
    );
  }, [versionedUpdate]);

  const startTimer = useCallback(async () => {
    if (!gameState) return;
    const now = new Date().toISOString();
    // Use timerState.currentClockSeconds as the resume point (written by stopTimer).
    // Fall back to gameState.clockSeconds if no timerState yet.
    const clockToResume = timerState?.currentClockSeconds ?? gameState.clockSeconds;
    await graphqlRequest(CONTROL_TIMER_MUTATION, {
      gameId,
      isRunning: true,
      startedAt: now,
      initialClockSeconds: clockToResume,
      currentClockSeconds: clockToResume,
      updatedAt: now,
      updatedBy: userId || 'anonymous',
    });
    await graphqlRequest(INIT_GAME_STATE_MUTATION, {
      gameId, ...gameState, isTimerRunning: true,
      updatedAt: now,
      updatedBy: userId || 'anonymous',
    });
  }, [gameState, timerState, gameId, userId]);

  const stopTimer = useCallback(async () => {
    if (!gameState || !timerState) return;
    const now = new Date();
    const nowISO = now.toISOString();
    let currentClock = timerState.initialClockSeconds;
    if (timerState.isRunning && timerState.startedAt) {
      const elapsed = Math.floor((now.getTime() - timerState.startedAt) / 1000);
      currentClock = Math.max(0, timerState.initialClockSeconds - elapsed);
    }
    await graphqlRequest(CONTROL_TIMER_MUTATION, {
      gameId,
      isRunning: false,
      startedAt: null,
      initialClockSeconds: currentClock,
      currentClockSeconds: currentClock,
      updatedAt: nowISO,
      updatedBy: userId || 'anonymous',
    });
    await graphqlRequest(INIT_GAME_STATE_MUTATION, {
      gameId, ...gameState, clockSeconds: currentClock, isTimerRunning: false,
      updatedAt: nowISO,
      updatedBy: userId || 'anonymous',
    });
  }, [gameState, timerState, gameId, userId]);

  const addEvent = useCallback(async (event: Omit<GameEvent, '_id' | 'gameId' | 'createdAt'>) => {
    await graphqlRequest(ADD_GAME_EVENT_MUTATION, {
      gameId,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: event.type,
      period: event.period,
      clockAt: event.clockAt,
      team: event.team,
      player: event.player,
      value: event.value,
      metadata: event.metadata,
      description: event.description,
      createdAt: new Date().toISOString(),
      createdBy: userId || 'anonymous',
    });
  }, [gameId, userId]);

  const removeEvent = useCallback(async (eventId: string) => {
    await graphqlRequest(DELETE_GAME_EVENT_MUTATION, { eventId });
  }, []);

  const updatePresence = useCallback(async () => {
    if (!userId || userId === 'anonymous') return;
    await graphqlRequest(UPSERT_SCORER_PRESENCE, {
      gameId,
      userId,
      lastActiveAt: new Date().toISOString(),
    });
  }, [gameId, userId]);

  const updateClock = useCallback(async (clockSeconds: number) => {
    if (!gameState) return;
    await graphqlRequest(UPDATE_CLOCK_MUTATION, {
      gameId,
      clockSeconds,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || 'anonymous',
    });
  }, [gameId, userId, gameState]);

  const updatePeriod = useCallback(async (currentPeriod: number) => {
    if (!gameState) return;
    await graphqlRequest(UPDATE_PERIOD_MUTATION, {
      gameId,
      currentPeriod,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || 'anonymous',
    });
  }, [gameId, userId, gameState]);

  const updatePossession = useCallback(async (possession: 'home' | 'guest') => {
    if (!gameState) return;
    await graphqlRequest(UPDATE_POSSESSION_MUTATION, {
      gameId,
      possession,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || 'anonymous',
    });
  }, [gameId, userId, gameState]);

  const initGameState = useCallback(async (initialClockSeconds: number = 600) => {
    await graphqlRequest(INIT_GAME_STATE_MUTATION, {
      gameId,
      homeScore: 0,
      guestScore: 0,
      homeFouls: 0,
      guestFouls: 0,
      homeTimeouts: 3,
      guestTimeouts: 3,
      clockSeconds: initialClockSeconds,
      currentPeriod: 1,
      possession: null,
      status: 'scheduled',
      isTimerRunning: false,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || 'anonymous',
    });
  }, [gameId, userId]);

  const updateGameStatus = useCallback(async (status: 'scheduled' | 'live' | 'final') => {
    if (!gameState) {
      // Initialize game state with the requested status
      await graphqlRequest(INIT_GAME_STATE_MUTATION, {
        gameId,
        homeScore: 0,
        guestScore: 0,
        homeFouls: 0,
        guestFouls: 0,
        homeTimeouts: 3,
        guestTimeouts: 3,
        clockSeconds: 600,
        currentPeriod: 1,
        possession: null,
        status,
        isTimerRunning: false,
        updatedAt: new Date().toISOString(),
        updatedBy: userId || 'anonymous',
      });
      return;
    }
    await graphqlRequest(UPDATE_STATUS_MUTATION, {
      gameId,
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || 'anonymous',
    });
  }, [gameId, userId, gameState]);

  // State for the ticking clock display
  const [displayClock, setDisplayClock] = useState(600);
  
  // Update display clock every second when timer is running
  useEffect(() => {
    // Calculate current clock value
    const calculateClock = () => {
      if (timerState?.isRunning && timerState?.startedAt) {
        return Math.max(0, timerState.initialClockSeconds - Math.floor((Date.now() - timerState.startedAt) / 1000));
      }
      return timerState?.currentClockSeconds ?? gameState?.clockSeconds ?? 600;
    };
    
    // Set initial value
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs external timer subscription to display state
    setDisplayClock(calculateClock());
    
    // If timer is running, set up interval to update every second
    if (timerState?.isRunning && timerState?.startedAt) {
      const interval = setInterval(() => {
        setDisplayClock(calculateClock());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [timerState?.isRunning, timerState?.startedAt, timerState?.initialClockSeconds, timerState?.currentClockSeconds, gameState?.clockSeconds]);

  return {
    gameState,
    gameEvents: hasura_game_events,
    currentClock: displayClock,
    isTimerRunning: timerState?.isRunning ?? gameState?.isTimerRunning ?? false,
    isConnected,
    activeScorers,
    conflictDetected,
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
    updatePresence,
  };
}
