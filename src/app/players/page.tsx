'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, User, Shield, Trophy, ArrowRight, Check, X, Globe, UserPlus } from 'lucide-react';

type Player = {
  id: string;
  name: string;
  firstName: string | null;
  surname: string | null;
  userId: string | null;
  isWorldAvailable: boolean;
  community: { name: string } | null;
  memberships: Array<{
    team: { name: string };
  }>;
};

export default function PlayersSearchPage() {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setPlayers([]);
      return;
    }

    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlayers(data);
        }
      } catch (err) {
        console.error('Failed to search players:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchPlayers, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleClaim = async (playerId: string) => {
    if (!confirm('Are you sure you want to claim this profile? This will link it to your account.')) return;
    
    setClaimingId(playerId);
    try {
      const res = await fetch(`/api/players/${playerId}/claim`, {
        method: 'POST',
      });
      
      if (res.ok) {
        alert('Profile claimed successfully!');
        router.push('/profile');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to claim profile');
      }
    } catch (err) {
      console.error('Failed to claim profile:', err);
      alert('Failed to claim profile');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black uppercase tracking-tight">Find Your Profile</h1>
        <p className="text-[var(--muted-foreground)]">Search for your name to link your stats to your account.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your first or last name..."
          className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl pl-14 pr-4 py-5 text-xl focus:outline-none focus:border-orange-500 shadow-xl transition-all"
          autoFocus
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : players.length > 0 ? (
          players.map((player) => (
            <div key={player.id} className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-orange-500/50 transition-all shadow-lg group">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 font-black text-2xl group-hover:scale-110 transition-transform">
                  {player.firstName?.[0] || player.name[0]}
                </div>
                <div>
                  <div className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    {player.name}
                    {player.isWorldAvailable && <Globe size={14} className="text-blue-500" />}
                  </div>
                  <div className="space-y-1 mt-1">
                    {player.community && (
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-foreground)]">
                        <Shield size={12} className="text-blue-500" />
                        {player.community.name}
                      </div>
                    )}
                    {player.memberships && player.memberships.length > 0 && (
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-foreground)]">
                        <Trophy size={12} className="text-orange-500" />
                        {player.memberships.map(m => m.team.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {player.userId ? (
                  <span className="bg-green-500/10 text-green-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 w-full sm:w-auto justify-center">
                    <Check size={14} /> Claimed
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaim(player.id)}
                    disabled={claimingId !== null}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 w-full sm:w-auto justify-center shadow-lg shadow-orange-900/20"
                  >
                    {claimingId === player.id ? 'Claiming...' : (
                      <>
                        <UserPlus size={16} /> Claim Profile
                      </>
                    )}
                  </button>
                )}
                <Link href={`/players/${player.id}`} className="flex-1 sm:flex-none">
                  <button className="bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all w-full">
                    View
                  </button>
                </Link>
              </div>
            </div>
          ))
        ) : query.length >= 2 ? (
          <div className="bg-[var(--card)]/50 border border-dashed border-[var(--border)] p-12 rounded-3xl text-center space-y-4">
            <User size={48} className="mx-auto text-slate-700" />
            <p className="text-[var(--muted-foreground)] italic">No players found matching "{query}".</p>
            <p className="text-xs text-[var(--muted-foreground)] max-w-xs mx-auto">
              If you haven't been added to a team yet, your profile might not exist. Ask your team manager or community admin.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
