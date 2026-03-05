'use client';

import { useState, useEffect, useCallback } from 'react';
import { type ScorerStatFocus, type PrimaryStatType } from '@/types/stats';

interface UseScorerFocusReturn {
  focus: ScorerStatFocus | null;
  loading: boolean;
  error: string | null;
  updateFocus: (statFocus: PrimaryStatType[]) => Promise<boolean>;
  refetch: () => void;
}

export function useScorerFocus(gameId: string): UseScorerFocusReturn {
  const [focus, setFocus] = useState<ScorerStatFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchFocus() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/games/${gameId}/scorer-focus`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch scorer focus');
        }

        const data = await response.json();
        if (!cancelled) {
          setFocus({
            statFocus: data.statFocus,
            showAllStats: data.showAllStats,
            focusUpdatedAt: data.focusUpdatedAt,
          });
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

    fetchFocus();

    return () => {
      cancelled = true;
    };
  }, [gameId, refreshCounter]);

  const updateFocus = useCallback(
    async (statFocus: PrimaryStatType[]): Promise<boolean> => {
      try {
        const response = await fetch(`/api/games/${gameId}/scorer-focus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statFocus }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.details?.[0] || 'Failed to update');
        }

        const updated = await response.json();
        setFocus(updated);
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
    focus,
    loading,
    error,
    updateFocus,
    refetch,
  };
}
