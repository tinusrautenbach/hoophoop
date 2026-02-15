'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@/components/auth-provider';
import Link from 'next/link';
import { School, Radio, Github } from 'lucide-react';

type Team = {
  id: string;
  name: string;
  shortCode: string | null;
  communityId: string | null;
  _count?: {
    memberships: number;
  };
  teamSeasons?: {
    seasonId: string;
    season: {
      id: string;
      name: string;
      status: string;
      startDate: string;
    };
  }[];
};

type Season = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  communityId: string;
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
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);

  // Extract unique seasons from teams
  useEffect(() => {
    if (teams.length > 0) {
      const seasonMap = new Map<string, Season>();
      
      teams.forEach(team => {
        if (team.teamSeasons) {
          team.teamSeasons.forEach(ts => {
            if (!seasonMap.has(ts.season.id)) {
              seasonMap.set(ts.season.id, {
                id: ts.season.id,
                name: ts.season.name,
                status: ts.season.status,
                startDate: ts.season.startDate,
                communityId: team.communityId || '',
              });
            }
          });
        }
      });
      
      // Sort seasons by start date (newest first)
      const sortedSeasons = Array.from(seasonMap.values()).sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      
      setAvailableSeasons(sortedSeasons);
    }
  }, [teams]);

  // Filter teams based on selected season
  const filteredTeams = selectedSeasonId
    ? teams.filter(team => 
        team.teamSeasons?.some(ts => ts.seasonId === selectedSeasonId)
      )
    : teams;

  // Get latest season (first in sorted list)
  const latestSeason = availableSeasons.length > 0 ? availableSeasons[0] : null;

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

    // Determine communityId and seasonId from selected teams
    let gameCommunityId = null;
    let gameSeasonId = selectedSeasonId;
    
    // Check if we need to swap Home/Guest to ensure Owner's team is Home (Left)
    // Logic: If Guest is one of my teams, and Home is NOT (e.g. Adhoc or empty), swap them.
    let finalHomeTeamId = homeTeamId && homeTeamId !== 'adhoc' ? homeTeamId : null;
    let finalGuestTeamId = guestTeamId && guestTeamId !== 'adhoc' ? guestTeamId : null;
    let finalHomeTeamName = (homeTeamId && homeTeamId !== 'adhoc' ? teams.find(t => t.id === homeTeamId)?.name : homeTeamName) || 'Home';
    let finalGuestTeamName = (guestTeamId && guestTeamId !== 'adhoc' ? teams.find(t => t.id === guestTeamId)?.name : guestTeamName) || 'Guest';

    const isGuestMyTeam = teams.some(t => t.id === guestTeamId);
    const isHomeMyTeam = teams.some(t => t.id === homeTeamId);

    if (isGuestMyTeam && !isHomeMyTeam) {
        console.log('Swapping teams to ensure Owner team is Home');
        // Swap IDs
        const tempId = finalHomeTeamId;
        finalHomeTeamId = finalGuestTeamId;
        finalGuestTeamId = tempId;

        // Swap Names
        const tempName = finalHomeTeamName;
        finalHomeTeamName = finalGuestTeamName;
        finalGuestTeamName = tempName;
    }
    
    if (finalHomeTeamId) {
      const homeTeam = teams.find(t => t.id === finalHomeTeamId);
      if (homeTeam?.communityId) {
        gameCommunityId = homeTeam.communityId;
      }
    }
    if (!gameCommunityId && finalGuestTeamId) {
      const guestTeam = teams.find(t => t.id === finalGuestTeamId);
      if (guestTeam?.communityId) {
        gameCommunityId = guestTeam.communityId;
      }
    }
    
    // If no season selected but teams have seasons, try to infer from teams
    if (!gameSeasonId && (finalHomeTeamId || finalGuestTeamId)) {
      const selectedTeam = finalHomeTeamId 
        ? teams.find(t => t.id === finalHomeTeamId)
        : teams.find(t => t.id === finalGuestTeamId);
      if (selectedTeam?.teamSeasons && selectedTeam.teamSeasons.length > 0) {
        // Use the most recent season
        const latestTeamSeason = selectedTeam.teamSeasons.sort(
          (a, b) => new Date(b.season.startDate).getTime() - new Date(a.season.startDate).getTime()
        )[0];
        gameSeasonId = latestTeamSeason.seasonId;
      }
    }

    const res = await fetch('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        homeTeamId: finalHomeTeamId,
        guestTeamId: finalGuestTeamId,
        homeTeamName: finalHomeTeamName,
        guestTeamName: finalGuestTeamName,
        name: gameName,
        scheduledDate,
        mode,
        visibility,
        communityId: gameCommunityId,
        seasonId: gameSeasonId,
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
            <a href="https://github.com/tinusrautenbach/hoophoop" target="_blank" rel="noopener noreferrer">
              <button className="bg-card hover:bg-muted text-muted-foreground hover:text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border border-border">
                <Github size={16} />
                GitHub
              </button>
            </a>
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

                {/* Season Filter */}
                {availableSeasons.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-xs uppercase font-bold tracking-widest text-slate-400 flex items-center gap-2">
                      Filter by Season
                      {latestSeason && (
                        <button
                          type="button"
                          onClick={() => setSelectedSeasonId(latestSeason.id)}
                          className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full hover:bg-orange-500/30 transition-colors"
                        >
                          Latest: {latestSeason.name}
                        </button>
                      )}
                      {selectedSeasonId && (
                        <button
                          type="button"
                          onClick={() => setSelectedSeasonId(null)}
                          className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full hover:bg-slate-600 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <select
                      value={selectedSeasonId || ''}
                      onChange={e => setSelectedSeasonId(e.target.value || null)}
                      className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none shadow-lg text-white"
                    >
                      <option value="">All Seasons</option>
                      {availableSeasons.map((season, index) => (
                        <option key={season.id} value={season.id}>
                          {season.name} {index === 0 ? '(Latest)' : `(${season.status})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                      {filteredTeams.map(team => (
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
                      {filteredTeams.map(team => (
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
              <a href="https://github.com/tinusrautenbach/hoophoop" target="_blank" rel="noopener noreferrer">
                <button className="bg-card hover:bg-muted text-muted-foreground hover:text-white font-bold py-4 px-8 rounded-2xl transition-all border border-border text-lg flex items-center gap-2">
                  <Github size={18} />
                  GitHub
                </button>
              </a>
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
