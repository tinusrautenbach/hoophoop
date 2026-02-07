'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

type Team = {
  id: string;
  name: string;
  shortCode: string | null;
};

export default function LandingPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [homeTeamId, setHomeTeamId] = useState('');
  const [guestTeamId, setGuestTeamId] = useState('');
  const [homeTeamName, setHomeTeamName] = useState('');
  const [guestTeamName, setGuestTeamName] = useState('');
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTeams(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    const res = await fetch('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        homeTeamId: homeTeamId || null,
        guestTeamId: guestTeamId || null,
        homeTeamName: homeTeamId ? teams.find(t => t.id === homeTeamId)?.name : homeTeamName,
        guestTeamName: guestTeamId ? teams.find(t => t.id === guestTeamId)?.name : guestTeamName,
        mode,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const game = await res.json();
      router.push(`/game/${game.id}/scorer`);
    } else {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-[80vh]">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tighter sm:text-7xl bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
            Score Like a <span className="text-orange-500">Pro</span>.
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-lg mx-auto">
            The ultimate real-time basketball scoring companion. Simple for casual games, powerful for official matches.
          </p>
        </div>

        <SignedIn>
          <div className="bg-slate-800/40 p-10 rounded-3xl border border-slate-700 backdrop-blur-sm shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-orange-600/20 transition-all duration-700"></div>

            <h2 className="text-2xl font-bold mb-8 text-left border-l-4 border-orange-500 pl-4">Setup New Game</h2>

            <form onSubmit={handleCreateGame} className="space-y-8 text-left">
              <div className="grid sm:grid-cols-2 gap-8">
                {/* Home Team Selection */}
                <div className="space-y-4">
                  <label className="text-xs uppercase font-bold tracking-widest text-orange-500">Home Team (Ours)</label>
                  <select
                    value={homeTeamId}
                    onChange={e => setHomeTeamId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg"
                  >
                    <option value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                    <option value="adhoc">Other / One-off</option>
                  </select>

                  {homeTeamId === 'adhoc' && (
                    <input
                      type="text"
                      placeholder="Enter Team Name"
                      value={homeTeamName}
                      onChange={e => setHomeTeamName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-2"
                      required
                    />
                  )}
                </div>

                {/* Guest Team Selection */}
                <div className="space-y-4">
                  <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Guest Team (Them)</label>
                  <select
                    value={guestTeamId}
                    onChange={e => setGuestTeamId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg"
                  >
                    <option value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                    <option value="adhoc">Other / One-off</option>
                  </select>
                  {(guestTeamId === 'adhoc' || guestTeamId === '') && guestTeamId !== 'adhoc' && !guestTeamId && (
                    /* If not selecting from dropdown, assume ad-hoc name */
                    <div className="text-[10px] text-slate-500 pl-1 mt-1 font-medium italic">Opponent score only in Simple Mode</div>
                  )}
                  {guestTeamId === 'adhoc' && (
                    <input
                      type="text"
                      placeholder="Enter Opponent Name"
                      value={guestTeamName}
                      onChange={e => setGuestTeamName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-2"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-4">
                <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Scoring Mode</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setMode('simple')}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'simple' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                  >
                    <div className={`font-bold ${mode === 'simple' ? 'text-orange-500' : 'text-slate-300'}`}>Simple</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-1">Score per individual (Home), Team score (Guest), Fouls, Time.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('advanced')}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'advanced' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                  >
                    <div className={`font-bold ${mode === 'advanced' ? 'text-orange-500' : 'text-slate-300'}`}>Advanced</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-1">Full stats, substitution tracking, shot charting, periods.</div>
                  </button>
                </div>
              </div>

              <button
                disabled={isCreating || (!homeTeamId && !homeTeamName)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-orange-500/20 disabled:opacity-50 text-lg"
              >
                {isCreating ? 'Initializing Stadium...' : 'START GAME'}
              </button>
            </form>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="space-y-6 pt-8">
            <SignInButton mode="modal">
              <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-12 rounded-2xl transition-all shadow-xl hover:shadow-orange-500/20 text-lg scale-105 active:scale-95">
                Get Started Now
              </button>
            </SignInButton>
            <div className="text-slate-500 text-sm">
              Free to use. Real-time updates. Pro stats.
            </div>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}
