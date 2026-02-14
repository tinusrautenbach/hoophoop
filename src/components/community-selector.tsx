'use client';

import { useState, useEffect } from 'react';

type Community = {
  id: string;
  name: string;
};

type CommunitySelectorProps = {
  selectedCommunityId: string | null;
  onSelect: (communityId: string | null) => void;
  className?: string;
};

export function CommunitySelector({ selectedCommunityId, onSelect, className }: CommunitySelectorProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/communities')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCommunities(data);
        } else {
          setCommunities([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch communities:', err);
        setCommunities([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <select
      value={selectedCommunityId || ''}
      onChange={(e) => onSelect(e.target.value || null)}
      className={`bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${className}`}
      disabled={loading}
    >
      <option value="">All Communities</option>
      {communities.map((community) => (
        <option key={community.id} value={community.id}>
          {community.name}
        </option>
      ))}
    </select>
  );
}
