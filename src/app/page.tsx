'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@/components/auth-provider';
import Link from 'next/link';
import { School, Radio } from 'lucide-react';

type Team = {
  id: string;
  name: string;
  shortCode: string | null;
  communityId: string | null;
  _count?: {
    memberships: number;
  };
};

export default function LandingPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [homeTeamId, setHomeTeamId] = useState('');
  const [guestTeamId, setGuestTeamId] = useState('');
  const [homeTeamName, setHomeTeamName] = useState('');
  const [guestTeamName, setGuestTeamName] = useState('');
  const [gameName, setGameName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [visibility, setVisibility] = useState<'private' | 'public_general' | 'public_community'>('private');
  const [isCreating, setIsCreating] = useState(false);
  const [periodSeconds, setPeriodSeconds] = useState(600); // 10 mins
  const [customMinutes, setCustomMinutes] = useState('10');
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [totalPeriods, setTotalPeriods] = useState(4);
  const [totalTimeouts, setTotalTimeouts] = useState(3);

  useEffect(() => {
    setMounted(true);
    // Set default date to today in YYYY-MM-DD format
    setScheduledDate(new Date().toISOString().split('T')[0]);

    if (userId) {
      fetch('/api/teams')
        .then(res => res.json())
        .then(data => {
          console.log('Teams fetched:', data);
          if (Array.isArray(data)) setTeams(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch teams:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate adhoc team names
    if (homeTeamId === 'adhoc' && !homeTeamName.trim()) {
      alert('Please enter a name for your home team');
      return;
    }
    if (guestTeamId === 'adhoc' && !guestTeamName.trim()) {
      alert('Please enter a name for the opponent team');
      return;
    }

    // Note: Roster validation skipped - API doesn't return player count
    // Teams can be used without players for testing purposes

    setIsCreating(true);

    // Determine communityId from selected teams
    let gameCommunityId = null;
    if (homeTeamId && homeTeamId !== 'adhoc') {
      const homeTeam = teams.find(t => t.id === homeTeamId);
      if (homeTeam?.communityId) {
        gameCommunityId = homeTeam.communityId;
      }
    }
    if (!gameCommunityId && guestTeamId && guestTeamId !== 'adhoc') {
      const guestTeam = teams.find(t => t.id === guestTeamId);
      if (guestTeam?.communityId) {
        gameCommunityId = guestTeam.communityId;
      }
    }

    const res = await fetch('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        homeTeamId: homeTeamId && homeTeamId !== 'adhoc' ? homeTeamId : null,
        guestTeamId: guestTeamId && guestTeamId !== 'adhoc' ? guestTeamId : null,
        homeTeamName: (homeTeamId && homeTeamId !== 'adhoc' ? teams.find(t => t.id === homeTeamId)?.name : homeTeamName) || 'Home',
        guestTeamName: (guestTeamId && guestTeamId !== 'adhoc' ? teams.find(t => t.id === guestTeamId)?.name : guestTeamName) || 'Guest',
        name: gameName,
        scheduledDate,
        mode,
        visibility,
        communityId: gameCommunityId,
        periodSeconds: isCustomTime ? Number(customMinutes) * 60 : Number(periodSeconds),
        totalPeriods: Number(totalPeriods),
        totalTimeouts: Number(totalTimeouts),
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('Create game response:', res.status, res.statusText);

    if (res.ok) {
      const game = await res.json();
      console.log('Game created:', game.id);
      router.push(`/game/${game.id}/scorer`);
    } else {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to create game:', error);
      alert(`Failed to create game: ${error.error || 'Unknown error'}`);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-[80vh]">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-6 flex flex-col items-center">
          <div className="w-24 h-24 sm:w-32 sm:h-32 relative mb-4 animate-bounce-slow">
            <img src="/logo.svg" alt="HoopHoop Logo" className="w-full h-full object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tighter sm:text-7xl bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
            Double the game. <span className="text-orange-500">Live the score.</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-lg mx-auto">
            HoopHoop is designed to amplify the excitement of local basketball by providing a seamless, real-time scoring platform that connects players, schools, and fans across the digital court.
          </p>
        </div>

        <SignedIn>
          <div className="flex justify-center gap-4 mb-8 flex-wrap">
            <Link href="/communities">
              <button className="bg-card hover:bg-muted text-muted-foreground hover:text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border border-border">
                <School size={16} />
                Manage Communities
              </button>
            </Link>
            <Link href="/live">
              <button className="bg-card hover:bg-muted text-orange-400 hover:text-orange-300 px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border border-border hover:border-orange-500/50">
                <Radio size={16} />
                Live Scores
              </button>
            </Link>
          </div>

          <div className="bg-card/40 p-10 rounded-3xl border border-border backdrop-blur-sm shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-orange-600/20 transition-all duration-700"></div>

            <h2 className="text-2xl font-bold mb-8 text-left border-l-4 border-orange-500 pl-4">Setup New Game</h2>

            {!mounted ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                <p className="text-slate-400">Loading...</p>
              </div>
            ) : (
              <form onSubmit={handleCreateGame} className="space-y-8 text-left">
                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Game Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Championship Final"
                      value={gameName}
                      onChange={e => setGameName(e.target.value)}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-white"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-white"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                  {/* Home Team Selection */}
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-orange-500">Home Team (Ours)</label>
                    <select
                      value={homeTeamId}
                      onChange={e => setHomeTeamId(e.target.value)}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
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
                        className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-2 text-white"
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
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
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
                        className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 mt-2 text-white"
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
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'simple' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card/50 hover:border-muted'}`}
                    >
                      <div className={`font-bold ${mode === 'simple' ? 'text-orange-500' : 'text-slate-300'}`}>Simple</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-1">Score per individual (Home), Team score (Guest), Fouls, Time.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('advanced')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${mode === 'advanced' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card/50 hover:border-muted'}`}
                    >
                      <div className={`font-bold ${mode === 'advanced' ? 'text-orange-500' : 'text-slate-300'}`}>Advanced</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-1">Full stats, substitution tracking, shot charting, periods.</div>
                    </button>
                  </div>
                </div>

                {/* Visibility Selection */}
                <div className="space-y-4">
                  <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Game Visibility</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${visibility === 'private' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card/50 hover:border-muted'}`}
                    >
                      <div className={`font-bold ${visibility === 'private' ? 'text-orange-500' : 'text-slate-300'}`}>Private</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-1">Only you and invited scorers can view and score.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('public_general')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${visibility === 'public_general' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card/50 hover:border-muted'}`}
                    >
                      <div className={`font-bold ${visibility === 'public_general' ? 'text-orange-500' : 'text-slate-300'}`}>Public</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-1">Visible to everyone on the live scores page.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('public_community')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${visibility === 'public_community' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card/50 hover:border-muted'}`}
                    >
                      <div className={`font-bold ${visibility === 'public_community' ? 'text-orange-500' : 'text-slate-300'}`}>Community</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-1">Visible on community portal if linked to one.</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Total Periods</label>
                    <select
                      value={totalPeriods}
                      onChange={e => setTotalPeriods(Number(e.target.value))}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
                    >
                      <option value={1}>1 (Straight)</option>
                      <option value={2}>2 Halves</option>
                      <option value={4}>4 Quarters</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Timeouts / Team</label>
                    <select
                      value={totalTimeouts}
                      onChange={e => setTotalTimeouts(Number(e.target.value))}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-4 col-span-2">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400">Time per Period</label>
                    <select
                      value={isCustomTime ? 'custom' : periodSeconds}
                      onChange={e => {
                        if (e.target.value === 'custom') {
                          setIsCustomTime(true);
                        } else {
                          setIsCustomTime(false);
                          setPeriodSeconds(Number(e.target.value));
                        }
                      }}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
                    >
                      <option value={300}>5 Mins</option>
                      <option value={480}>8 Mins</option>
                      <option value={600}>10 Mins</option>
                      <option value={720}>12 Mins</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {isCustomTime && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          placeholder="Minutes"
                          value={customMinutes}
                          onChange={e => setCustomMinutes(e.target.value)}
                          className="flex-1 bg-input border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-white"
                          min="1"
                        />
                        <span className="text-[10px] uppercase font-bold text-slate-500">Mins</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreating || (homeTeamId === '' && !homeTeamName.trim()) || loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-orange-500/20 disabled:opacity-50 text-lg"
                >
                  {isCreating ? 'Initializing Stadium...' : loading ? 'Loading Teams...' : 'START GAME'}
                </button>
              </form>
            )}
          </div>
        </SignedIn>

        <SignedOut>
          <div className="space-y-6 pt-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <SignInButton mode="modal">
                <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-12 rounded-2xl transition-all shadow-xl hover:shadow-orange-500/20 text-lg scale-105 active:scale-95">
                  Get Started Now
                </button>
              </SignInButton>
              <Link href="/live">
                <button className="bg-card hover:bg-muted text-orange-400 hover:text-orange-300 font-bold py-4 px-8 rounded-2xl transition-all border border-border hover:border-orange-500/50 text-lg flex items-center gap-2">
                  <Radio size={18} />
                  View Live Scores
                </button>
              </Link>
            </div>
            <div className="text-slate-500 text-sm">
              Free to use. Real-time updates. Pro stats.
            </div>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}
