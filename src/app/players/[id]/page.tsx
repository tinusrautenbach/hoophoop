'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Edit2, History, User, Shield, Globe, BarChart3, Trophy, TrendingUp, Activity, Mail, X, Copy, Check } from 'lucide-react';

  type Player = {
  id: string;
  name: string;
  firstName: string | null;
  surname: string | null;
  email: string | null;
  birthDate: string | null;
  status: string;
  isWorldAvailable: boolean;
  userId: string | null;
  community: { id: string; name: string } | null;
  createdAt: string;
};

type TeamMembership = {
  id: string;
  number: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  team: {
    id: string;
    name: string;
    shortCode: string | null;
  };
};

type HistoryEntry = {
  id: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: string;
  team: {
    id: string;
    name: string;
  } | null;
};

type Stats = {
  lifetimeStats: {
    gamesPlayed: number;
    totalPoints: number;
    totalFouls: number;
    avgPoints: number;
    avgFouls: number;
  };
  teamStats: Array<{
    teamId: string;
    teamName: string;
    gamesPlayed: number;
    totalPoints: number;
    totalFouls: number;
    wins: number;
    losses: number;
    avgPoints: number;
    avgFouls: number;
  }>;
  recentGames: Array<{
    gameId: string;
    gameName: string | null;
    scheduledDate: string | null;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    points: number;
    fouls: number;
    team: 'home' | 'guest';
  }>;
};

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', surname: '', email: '', birthDate: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'history'>('overview');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  
  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (player?.community?.id) {
      fetch(`/api/seasons?communityId=${player.community.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSeasons(data);
        })
        .catch(err => console.error('Failed to load seasons:', err));
    }
  }, [player?.community?.id]);

  useEffect(() => {
    if (!playerId) return;
    
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTeamId) params.append('teamId', selectedTeamId);
    if (selectedSeasonId) params.append('seasonId', selectedSeasonId);

    fetch(`/api/players/${playerId}/stats?${params.toString()}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load stats: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setStats(null);
        setLoading(false);
      });
  }, [playerId, selectedTeamId, selectedSeasonId]);

  useEffect(() => {
    fetch(`/api/players/${playerId}`)
      .then(res => {
        if (!res.ok) throw new Error('Player not found');
        return res.json();
      })
      .then(data => {
        setPlayer(data);
        setMemberships(data.memberships || []);
        setHistory(data.history || []);
        setEditForm({
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          surname: data.surname || data.name?.split(' ').slice(1).join(' ') || '',
          email: data.email || '',
          birthDate: data.birthDate || '',
        });
      })
      .catch(() => {
        router.push('/teams');
      });
  }, [playerId, router]);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await fetch(`/api/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: editForm.firstName,
        surname: editForm.surname,
        email: editForm.email || null,
        birthDate: editForm.birthDate || null,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setPlayer({ ...player!, ...updated });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!player) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/teams" className="text-sm text-[var(--muted-foreground)] hover:text-orange-500 flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Teams
          </Link>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Player Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
              <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                <User size={48} className="text-orange-500" />
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Surname</label>
                    <input
                      type="text"
                      value={editForm.surname}
                      onChange={e => setEditForm({ ...editForm, surname: e.target.value })}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Birth Date</label>
                    <input
                      type="date"
                      value={editForm.birthDate}
                      onChange={e => setEditForm({ ...editForm, birthDate: e.target.value })}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          firstName: player.firstName || player.name?.split(' ')[0] || '',
                          surname: player.surname || player.name?.split(' ').slice(1).join(' ') || '',
                          email: player.email || '',
                          birthDate: player.birthDate || '',
                        });
                      }}
                      className="flex-1 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] py-2 rounded-lg text-sm font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-center mb-1">{player.name}</h1>
                  <div className="flex items-center justify-center gap-2 text-sm mb-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${player.status === 'active' ? 'bg-green-500/20 text-green-400' : player.status === 'merged' ? 'bg-purple-500/20 text-purple-400' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                      {player.status}
                    </span>
                    {player.isWorldAvailable && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Globe size={10} /> World
                      </span>
                    )}
                  </div>

                  {player.email && (
                    <div className="text-sm text-[var(--muted-foreground)] text-center mb-2">{player.email}</div>
                  )}
                  {player.birthDate && (
                    <div className="text-sm text-[var(--muted-foreground)] text-center mb-2 flex items-center justify-center gap-1">
                      <Calendar size={14} />
                      Born: {formatDate(player.birthDate)}
                    </div>
                  )}
                  {player.community && (
                    <div className="text-sm text-[var(--muted-foreground)] text-center mb-4 flex items-center justify-center gap-1">
                      <Shield size={14} />
                      {player.community.name}
                    </div>
                  )}

                  {stats && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-500">{stats.lifetimeStats.gamesPlayed}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase">Games</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-500">{stats.lifetimeStats.avgPoints}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase">PPG</div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Edit2 size={14} /> Edit Profile
                  </button>
                  
                  {!player.userId && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="w-full mt-2 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Mail size={14} /> Invite Player
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--border)]">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'overview' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                <Activity size={14} className="inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'stats' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                <BarChart3 size={14} className="inline mr-2" />
                Statistics
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'history' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                <History size={14} className="inline mr-2" />
                History
              </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Lifetime Stats */}
                {stats && (
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
                    <h2 className="text-sm font-black uppercase tracking-wider text-[var(--foreground)] mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-orange-500" />
                      Lifetime Statistics
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.gamesPlayed}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Games Played</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.totalPoints}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Total Points</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.avgPoints}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Points Per Game</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.avgFouls}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Fouls Per Game</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Memberships */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-lg">
                  <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
                    <Shield size={18} className="text-orange-500" />
                    <h2 className="font-black text-sm uppercase tracking-wider text-[var(--foreground)]">Team Memberships</h2>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {memberships.map(membership => (
                      <div key={membership.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--muted)] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center font-black text-orange-500">
                            {membership.number || '--'}
                          </div>
                          <div>
                            <Link href={`/teams/${membership.team.id}`} className="font-bold text-[var(--foreground)] hover:text-orange-500">
                              {membership.team.name}
                            </Link>
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {formatDate(membership.startDate)}
                              {membership.endDate && ` - ${formatDate(membership.endDate)}`}
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${membership.isActive ? 'bg-green-500/20 text-green-400' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                          {membership.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                    {memberships.length === 0 && (
                      <div className="px-6 py-8 text-center text-[var(--muted-foreground)] italic">
                        No team memberships yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Games */}
                {stats && stats.recentGames.length > 0 && (
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
                      <Trophy size={18} className="text-orange-500" />
                      <h2 className="font-black text-sm uppercase tracking-wider text-[var(--foreground)]">Recent Games</h2>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {stats.recentGames.slice(0, 5).map((game, index) => {
                        const playerScore = game.team === 'home' ? game.homeScore : game.guestScore;
                        const opponentScore = game.team === 'home' ? game.guestScore : game.homeScore;
                        const won = playerScore > opponentScore;

                        return (
                          <Link key={index} href={`/game/${game.gameId}`}>
                            <div className="px-6 py-4 flex items-center justify-between hover:bg-[var(--muted)] transition-colors cursor-pointer">
                              <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${won ? 'bg-green-500' : 'bg-red-500'}`} />
                                <div>
                                  <div className="font-bold text-[var(--foreground)]">
                                    {game.homeTeamName} vs {game.guestTeamName}
                                  </div>
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    {formatDate(game.scheduledDate)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="font-black text-[var(--foreground)]">
                                    {game.homeScore} - {game.guestScore}
                                  </div>
                                  <div className="text-xs text-orange-500">
                                    {game.points} pts, {game.fouls} fouls
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Statistics Tab */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.teamStats.length > 0 && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                      <label className="text-xs font-black uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">
                        Filter by Team
                      </label>
                      <select
                        value={selectedTeamId || ''}
                        onChange={(e) => setSelectedTeamId(e.target.value || null)}
                        className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">All Teams (Lifetime)</option>
                        {stats.teamStats.map(team => (
                          <option key={team.teamId} value={team.teamId}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {seasons.length > 0 && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                      <label className="text-xs font-black uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">
                        Filter by Season
                      </label>
                      <select
                        value={selectedSeasonId || ''}
                        onChange={(e) => setSelectedSeasonId(e.target.value || null)}
                        className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">All Seasons</option>
                        {seasons.map(season => (
                          <option key={season.id} value={season.id}>
                            {season.name} ({season.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Selected Team Stats or Lifetime Stats */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
                  <h2 className="text-sm font-black uppercase tracking-wider text-[var(--foreground)] mb-4">
                    {selectedTeamId ? 'Team Statistics' : selectedSeasonId ? 'Season Statistics' : 'Lifetime Statistics'}
                  </h2>
                  {selectedTeamId ? (
                    stats.teamStats
                      .filter(t => t.teamId === selectedTeamId)
                      .map(team => (
                        <div key={team.teamId} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-orange-500">{team.gamesPlayed}</div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Games</div>
                          </div>
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-orange-500">{team.totalPoints}</div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Points</div>
                          </div>
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-orange-500">{team.avgPoints}</div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">PPG</div>
                          </div>
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-green-500">{team.wins}</div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Wins</div>
                          </div>
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-red-500">{team.losses}</div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Losses</div>
                          </div>
                          <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-orange-500">
                              {team.gamesPlayed > 0 ? Math.round((team.wins / team.gamesPlayed) * 100) : 0}%
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Win Rate</div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.gamesPlayed}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Games Played</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.totalPoints}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Total Points</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.avgPoints}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">PPG</div>
                      </div>
                      <div className="bg-[var(--muted)] rounded-xl p-4 text-center">
                        <div className="text-3xl font-black text-orange-500">{stats.lifetimeStats.avgFouls}</div>
                        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">Fouls Per Game</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* All Teams Table */}
                {stats.teamStats.length > 0 && (
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-6 py-4 border-b border-[var(--border)]">
                      <h2 className="font-black text-sm uppercase tracking-wider text-[var(--foreground)]">Statistics by Team</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--muted)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                          <tr>
                            <th className="px-6 py-3 text-left font-bold">Team</th>
                            <th className="px-6 py-3 text-center font-bold">GP</th>
                            <th className="px-6 py-3 text-center font-bold">PTS</th>
                            <th className="px-6 py-3 text-center font-bold">PPG</th>
                            <th className="px-6 py-3 text-center font-bold">W</th>
                            <th className="px-6 py-3 text-center font-bold">L</th>
                            <th className="px-6 py-3 text-center font-bold">Win %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {stats.teamStats.map(team => (
                            <tr key={team.teamId} className="hover:bg-[var(--muted)]">
                              <td className="px-6 py-4 font-medium text-[var(--foreground)]">{team.teamName}</td>
                              <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">{team.gamesPlayed}</td>
                              <td className="px-6 py-4 text-center font-bold text-orange-500">{team.totalPoints}</td>
                              <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">{team.avgPoints}</td>
                              <td className="px-6 py-4 text-center text-green-500 font-bold">{team.wins}</td>
                              <td className="px-6 py-4 text-center text-red-500 font-bold">{team.losses}</td>
                              <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">
                                {team.gamesPlayed > 0 ? Math.round((team.wins / team.gamesPlayed) * 100) : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-lg">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="font-black text-sm uppercase tracking-wider text-[var(--foreground)]">Activity History</h2>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {history.map(entry => (
                    <div key={entry.id} className="px-6 py-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-[var(--foreground)] capitalize">
                            {entry.action.replace(/_/g, ' ')}
                            {entry.team && <span className="text-[var(--muted-foreground)]"> - {entry.team.name}</span>}
                          </div>
                          {entry.notes && <div className="text-sm text-[var(--muted-foreground)] mt-1">{entry.notes}</div>}
                          {entry.previousValue && entry.newValue && (
                            <div className="text-sm text-[var(--muted-foreground)] mt-1">
                              #{entry.previousValue} &rarr; #{entry.newValue}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-[var(--muted-foreground)]">
                          {formatDate(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="px-6 py-8 text-center text-[var(--muted-foreground)] italic">
                      No activity history recorded.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Invite Player Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Mail size={20} className="text-orange-500" />
                Invite Player
              </h3>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteLink(null);
                  setInviteError(null);
                }}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X size={20} />
              </button>
            </div>
            
            {inviteLink ? (
              <div className="space-y-4">
                <div className="bg-green-500/20 text-green-400 p-3 rounded-lg text-sm">
                  Invitation created successfully!
                </div>
                <div className="text-sm text-[var(--muted-foreground)] mb-2">
                  Share this link with the player:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsInviting(true);
                  setInviteError(null);
                  
                  try {
                    const res = await fetch('/api/players/invite', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        athleteId: playerId, 
                        email: inviteEmail 
                      }),
                    });
                    
                    if (res.ok) {
                      const data = await res.json();
                      setInviteLink(data.invitationLink);
                    } else {
                      const error = await res.json();
                      setInviteError(error.error || 'Failed to create invitation');
                    }
                  } catch (err) {
                    setInviteError('Failed to create invitation');
                  } finally {
                    setIsInviting(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Player Email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    required
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    The player will receive an email with a link to claim their profile.
                  </p>
                </div>
                
                {inviteError && (
                  <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                    {inviteError}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteError(null);
                    }}
                    className="flex-1 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] py-2 rounded-lg text-sm font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-bold"
                  >
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
