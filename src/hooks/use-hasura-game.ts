import { useState, useEffect, useCallback, useRef } from 'react';

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
  id: string;
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
}

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql';

export function useHasuraGame(gameId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const wsUrl = HASURA_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'connection_init',
        payload: {}
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: 'game-state',
          type: 'subscribe',
          payload: {
            query: `
              subscription GetGameState($gameId: uuid!) {
                games_by_pk(id: $gameId) {
                  id
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
                }
              }
            `,
            variables: { gameId }
          }
        }));

        ws.send(JSON.stringify({
          id: 'game-events',
          type: 'subscribe',
          payload: {
            query: `
              subscription GetGameEvents($gameId: uuid!) {
                gameEvents(where: { gameId: { _eq: $gameId } }, order_by: { createdAt: desc }, limit: 100) {
                  id
                  gameId
                  type
                  period
                  clockAt
                  team
                  player
                  value
                  metadata
                  description
                  createdAt
                }
              }
            `,
            variables: { gameId }
          }
        }));
      }
      
      if (data.type === 'data') {
        if (data.id === 'game-state' && data.payload?.data?.games_by_pk) {
          setGameState(data.payload.data.games_by_pk);
        }
        if (data.id === 'game-events' && data.payload?.data?.gameEvents) {
          setGameEvents(data.payload.data.gameEvents.reverse());
        }
      }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);

    return () => ws.close();
  }, [gameId]);

  const executeMutation = useCallback(async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch(HASURA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  }, []);

  const updateScore = useCallback(async (team: 'home' | 'guest', points: number) => {
    const updates = team === 'home' 
      ? { homeScore: (gameState?.homeScore ?? 0) + points }
      : { guestScore: (gameState?.guestScore ?? 0) + points };
    
    await executeMutation(`
      mutation UpdateGameState($gameId: uuid!, $updates: games_set_input!) {
        update_games_by_pk(pk_columns: { id: $gameId }, _set: $updates) { id }
      }
    `, { gameId, updates });
  }, [gameId, gameState, executeMutation]);

  const updateFouls = useCallback(async (team: 'home' | 'guest', fouls: number) => {
    const updates = team === 'home' ? { homeFouls: fouls } : { guestFouls: fouls };
    await executeMutation(`
      mutation UpdateGameState($gameId: uuid!, $updates: games_set_input!) {
        update_games_by_pk(pk_columns: { id: $gameId }, _set: $updates) { id }
      }
    `, { gameId, updates });
  }, [gameId, executeMutation]);

  const updateTimeouts = useCallback(async (team: 'home' | 'guest', timeouts: number) => {
    const updates = team === 'home' ? { homeTimeouts: timeouts } : { guestTimeouts: timeouts };
    await executeMutation(`
      mutation UpdateGameState($gameId: uuid!, $updates: games_set_input!) {
        update_games_by_pk(pk_columns: { id: $gameId }, _set: $updates) { id }
      }
    `, { gameId, updates });
  }, [gameId, executeMutation]);

  const startTimer = useCallback(async () => {
    await executeMutation(`
      mutation UpdateTimer($gameId: uuid!) {
        update_timerSync_by_pk(pk_columns: { gameId: $gameId }, _set: { isRunning: true }) { gameId }
      }
    `, { gameId });
  }, [gameId, executeMutation]);

  const stopTimer = useCallback(async () => {
    await executeMutation(`
      mutation UpdateTimer($gameId: uuid!) {
        update_timerSync_by_pk(pk_columns: { gameId: $gameId }, _set: { isRunning: false }) { gameId }
      }
    `, { gameId });
  }, [gameId, executeMutation]);

  const addEvent = useCallback(async (event: Omit<GameEvent, 'id' | 'gameId'>) => {
    await executeMutation(`
      mutation AddGameEvent($event: gameEvents_insert_input!) {
        insert_gameEvents_one(object: $event) { id }
      }
    `, { event: { ...event, gameId } });
  }, [gameId, executeMutation]);

  const removeEvent = useCallback(async (eventId: string) => {
    await executeMutation(`
      mutation DeleteGameEvent($eventId: uuid!) {
        delete_gameEvents_by_pk(id: $eventId) { id }
      }
    `, { eventId });
  }, [executeMutation]);

  return {
    gameState,
    gameEvents,
    isConnected,
    updateScore,
    updateFouls,
    updateTimeouts,
    startTimer,
    stopTimer,
    addEvent,
    removeEvent,
  };
}
