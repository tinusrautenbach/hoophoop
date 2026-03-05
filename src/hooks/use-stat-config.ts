'use client';

import { useState, useEffect, useCallback } from 'react';
import { type GameStatConfig, type PrimaryStatType } from '@/types/stats';

interface UseStatConfigReturn {
  config: GameStatConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (enabledStats: PrimaryStatType[]) => Promise<boolean>;
  refetch: () => void;
}

export function useStatConfig(gameId: string): UseStatConfigReturn {
  const [config, setConfig] = useState<GameStatConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchConfig() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/games/${gameId}/stat-config`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch stat config');
        }

        const data = await response.json();
        if (!cancelled) {
          setConfig(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchConfig();

    return () => {
      cancelled = true;
    };
  }, [gameId, refreshCounter]);

  const updateConfig = useCallback(
    async (enabledStats: PrimaryStatType[]): Promise<boolean> => {
      try {
        const response = await fetch(`/api/games/${gameId}/stat-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledStats }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.details?.[0] || 'Failed to update');
        }

        const updated = await response.json();
        setConfig(updated);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        return false;
      }
    },
    [gameId]
  );

  const refetch = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  return {
    config,
    loading,
    error,
    updateConfig,
    refetch,
  };
}
