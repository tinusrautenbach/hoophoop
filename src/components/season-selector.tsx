'use client';

import { useState, useEffect } from 'react';

type Season = {
  id: string;
  name: string;
  status: string;
};

type SeasonSelectorProps = {
  communityId?: string;
  selectedSeasonId: string | null;
  onSelect: (seasonId: string | null) => void;
  className?: string;
};

export function SeasonSelector({ communityId, selectedSeasonId, onSelect, className }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!communityId) {
      return;
    }

    let isMounted = true;
    // Schedule state update in a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (isMounted) {
        setLoading(true);
      }
    });
    
    fetch(`/api/seasons?communityId=${communityId}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (Array.isArray(data)) {
            setSeasons(data);
          } else {
            setSeasons([]);
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch seasons:', err);
        if (isMounted) {
          setSeasons([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    
    return () => {
      isMounted = false;
    };
  }, [communityId]);

  return (
    <select
      value={selectedSeasonId || ''}
      onChange={(e) => onSelect(e.target.value || null)}
      className={`bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${className}`}
      disabled={loading || !communityId}
    >
      <option value="">All Seasons</option>
      {seasons.map((season) => (
        <option key={season.id} value={season.id}>
          {season.name} ({season.status})
        </option>
      ))}
    </select>
  );
}
