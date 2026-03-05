'use client';

import { useMemo } from 'react';
import { type PlayerStatEvent, type PlayerGameStats } from '@/types/stats';
import { aggregateAllPlayerStats } from '@/lib/stats/stat-aggregator';

interface UsePlayerStatsReturn {
  playerStats: Map<string, PlayerGameStats>;
  homeTeamStats: PlayerGameStats[];
  guestTeamStats: PlayerGameStats[];
  isLoading: boolean;
}

export function usePlayerStats(
  events: PlayerStatEvent[] | undefined,
  gameId: string
): UsePlayerStatsReturn {
  const playerStats = useMemo(() => {
    if (!events || events.length === 0) {
      return new Map<string, PlayerGameStats>();
    }

    const statEvents = events.filter((e) => e.type === 'stat' && e.statType);
    return aggregateAllPlayerStats(statEvents, gameId);
  }, [events, gameId]);

  const homeTeamStats = useMemo(() => {
    return Array.from(playerStats.values()).filter((s) => s.team === 'home');
  }, [playerStats]);

  const guestTeamStats = useMemo(() => {
    return Array.from(playerStats.values()).filter((s) => s.team === 'guest');
  }, [playerStats]);

  return {
    playerStats,
    homeTeamStats,
    guestTeamStats,
    isLoading: !events,
  };
}
