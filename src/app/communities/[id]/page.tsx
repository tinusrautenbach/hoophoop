'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Trophy, Mail, Copy, Check, Shield, Eye, ShieldAlert, Trash2, RotateCcw, Calendar } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type TabType = 'overview' | 'teams' | 'seasons' | 'tournaments' | 'members' | 'settings' | 'deleted-games';

type Community = {
    id: string;
    name: string;
    type: string;
    ownerId: string;
    members: CommunityMember[];
    teams?: Team[];
    seasons?: Season[];
    games?: Game[];
};

type CommunityMember = {
    id: string;
    userId: string;
    displayName: string;
    userEmail?: string;
    role: string;
};

type Team = {
    id: string;
    name: string;
    shortCode: string | null;
    color: string | null;
    createdAt: string;
    teamSeasons?: TeamSeason[];
    memberships?: Membership[];
};

type TeamSeason = {
    id: string;
    seasonId: string;
    teamId?: string;
    season?: {
        id: string;
        name: string;
    };
    team?: {
        id: string;
        name: string;
        color?: string;
    };
};

type Season = {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    description?: string;
    teamSeasons?: TeamSeason[];
};

type Tournament = {
    id: string;
    name: string;
    status: string;
    type: string;
    startDate: string;
    endDate: string;
    teams?: { id: string }[];
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    status: string;
    createdAt: string;
};

type DeletedGame = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    deletedAt: string;
    ownerName: string;
};

type Membership = {
    id: string;
    athleteId: string;
    athlete?: {
        name: string;
    };
};

export default function CommunityDashboard() {
    const { id } = useParams();
    const router = useRouter();
    const { userId } = useAuth();
    
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'seasons' | 'tournaments' | 'members' | 'settings' | 'deleted-games'>('overview');
    const [communityTeams, setCommunityTeams] = useState<Team[]>([]);
    const [communitySeasons, setCommunitySeasons] = useState<Season[]>([]);
    const [communityTournaments, setCommunityTournaments] = useState<Tournament[]>([]);
    const [tournamentsLoading, setTournamentsLoading] = useState(false);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('scorer');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [deletedGames, setDeletedGames] = useState<DeletedGame[]>([]);
    const [deletedGamesLoading, setDeletedGamesLoading] = useState(false);
    const [memberTab, setMemberTab] = useState<'users' | 'athletes'>('users');

    // Season form state
    const [showSeasonForm, setShowSeasonForm] = useState(false);
    const [newSeason, setNewSeason] = useState({
        name: '',
        startDate: '',
        endDate: '',
        description: ''
    });
    const [isCreatingSeason, setIsCreatingSeason] = useState(false);
    
    // Team-Season management state
    const [selectedTeamForSeason, setSelectedTeamForSeason] = useState<string | null>(null);
    const [selectedSeasonForTeam, setSelectedSeasonForTeam] = useState<string>('');
    const [isAddingTeamToSeason, setIsAddingTeamToSeason] = useState(false);
    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/communities/${id}`)
            .then(res => res.json())
            .then(data => {
                setCommunity(data);
                setCommunitySeasons(data.seasons || []);
                setCommunityTeams(data.teams || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                router.push('/communities');
            });
    }, [id, router]);

    useEffect(() => {
        if (activeTab === 'tournaments' && communityTournaments.length === 0) {
            setTournamentsLoading(true);
            fetch(`/api/tournaments?communityId=${id}`)
                .then(res => res.json())
                .then(data => {
                    setCommunityTournaments(Array.isArray(data) ? data : []);
                    setTournamentsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setTournamentsLoading(false);
                });
        }
    }, [activeTab, id, communityTournaments.length]);

    useEffect(() => {
        if (activeTab === 'deleted-games') {
            setDeletedGamesLoading(true);
            fetch(`/api/communities/${id}/deleted-games`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setDeletedGames(data);
                    }
                    setDeletedGamesLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch deleted games:', err);
                    setDeletedGamesLoading(false);
                });
        }
    }, [activeTab, id]);

    const handleRestoreGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to restore this game?')) return;
        
        try {
            const res = await fetch(`/api/communities/${id}/deleted-games/${gameId}`, {
                method: 'POST'
            });
            if (res.ok) {
                setDeletedGames(prev => prev.filter(g => g.id !== gameId));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to restore game');
            }
        } catch (err) {
            console.error('Failed to restore game:', err);
            alert('Failed to restore game');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/communities/${id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            
            if (res.ok) {
                const data = await res.json();
                setInviteLink(data.inviteLink);
            }
        } catch (error) {
            console.error('Invite failed:', error);
        }
    };

    const handleCreateSeason = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingSeason(true);
        try {
            const res = await fetch('/api/seasons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newSeason,
                    communityId: id,
                }),
            });

            if (res.ok) {
                const season = await res.json();
                setCommunitySeasons([season, ...communitySeasons]);
                setShowSeasonForm(false);
                setNewSeason({ name: '', startDate: '', endDate: '', description: '' });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create season');
            }
        } catch (error) {
            console.error('Failed to create season:', error);
            alert('Failed to create season');
        } finally {
            setIsCreatingSeason(false);
        }
    };

    const handleAddTeamToSeason = async (teamId: string, seasonId: string) => {
        if (!teamId || !seasonId) return;
        setIsAddingTeamToSeason(true);
        try {
            const res = await fetch(`/api/seasons/${seasonId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId }),
            });

            if (res.ok) {
                // Refresh community data to get updated team-season relationships
                const communityRes = await fetch(`/api/communities/${id}`);
                if (communityRes.ok) {
                    const data = await communityRes.json();
                    setCommunityTeams(data.teams || []);
                    setCommunitySeasons(data.seasons || []);
                }
                setSelectedTeamForSeason(null);
                setSelectedSeasonForTeam('');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to add team to season');
            }
        } catch (error) {
            console.error('Failed to add team to season:', error);
            alert('Failed to add team to season');
        } finally {
            setIsAddingTeamToSeason(false);
        }
    };

    const handleRemoveTeamFromSeason = async (teamId: string, seasonId: string) => {
        if (!confirm('Remove this team from the season?')) return;
        try {
            const res = await fetch(`/api/seasons/${seasonId}/teams?teamId=${teamId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Refresh community data
                const communityRes = await fetch(`/api/communities/${id}`);
                if (communityRes.ok) {
                    const data = await communityRes.json();
                    setCommunityTeams(data.teams || []);
                    setCommunitySeasons(data.seasons || []);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove team from season');
            }
        } catch (error) {
            console.error('Failed to remove team from season:', error);
            alert('Failed to remove team from season');
        }
    };

    const handleRemoveMember = async (targetUserId: string, displayName: string) => {
        if (!confirm(`Remove ${displayName} from this community?`)) return;
        try {
            const res = await fetch(`/api/communities/${id}/members/${targetUserId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                const communityRes = await fetch(`/api/communities/${id}`);
                if (communityRes.ok) {
                    const data = await communityRes.json();
                    setCommunity(data);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove member');
            }
        } catch (error) {
            console.error('Failed to remove member:', error);
            alert('Failed to remove member');
        }
    };

    const handleChangeRole = async (targetUserId: string, newRole: 'admin' | 'scorer' | 'viewer') => {
        try {
            const res = await fetch(`/api/communities/${id}/members/${targetUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) {
                const communityRes = await fetch(`/api/communities/${id}`);
                if (communityRes.ok) {
                    const data = await communityRes.json();
                    setCommunity(data);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update member role');
            }
        } catch (error) {
            console.error('Failed to update member role:', error);
            alert('Failed to update member role');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading community...</div>;
    if (!community) return null;

    const isOwner = community.ownerId === userId;
    const currentUserMember = community.members.find((m: CommunityMember) => m.userId === userId);
    const isAdmin = isOwner || currentUserMember?.role === 'admin';
    const isScorer = isOwner || isAdmin || currentUserMember?.role === 'scorer';

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <button onClick={() => router.push('/communities')} className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
                <ArrowLeft size={20} />
                Back to Communities
            </button>

            {/* Header */}
            <div className="bg-input border border-border rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-500/10 text-orange-500 px-2 py-1 rounded">
                            {community.type}
                        </span>
                        {isOwner && <span className="text-[10px] font-bold uppercase tracking-widest bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">Owner</span>}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">{community.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                        <div className="flex items-center gap-1">
                            <Users size={16} />
                            <span>{community.members.length} Members</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Trophy size={16} />
                            <span>{community.teams?.length || 0} Teams</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border gap-6 overflow-x-auto">
                {['overview', 'teams', 'seasons', 'tournaments', 'members', 'settings', ...(isAdmin ? ['deleted-games'] : [])].map((tab) => (
                    <button
                        key={tab}
                                                    onClick={() => setActiveTab(tab as TabType)}
                        className={cn(
                            "pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                            activeTab === tab
                                ? "text-orange-500 border-b-2 border-orange-500"
                                : "text-slate-500 hover:text-white"
                        )}
                    >
                        {tab === 'deleted-games' ? 'Deleted Games' : tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">Recent Games</h3>
                            {community.games && community.games.length > 0 ? (
                                <div className="space-y-3">
                                    {community.games?.map((game: Game) => {
                                        // Route to scorer interface for live/scheduled games OR if user has scorer rights
                                        // Otherwise route to spectator page for finished games
                                        const shouldGoToScorer = game.status !== 'final' || isScorer;
                                        const gameLink = shouldGoToScorer
                                            ? `/game/${game.id}/scorer` 
                                            : `/game/${game.id}`;
                                        
                                        return (
                                            <Link
                                                key={game.id}
                                                href={gameLink}
                                                className="flex justify-between items-center bg-background p-3 rounded-xl border border-border hover:border-orange-500/50 hover:bg-input transition-all cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm font-bold">
                                                        <span className="text-orange-500">{game.homeTeamName}</span>
                                                        <span className="text-slate-500 mx-2">vs</span>
                                                        <span className="text-white">{game.guestTeamName}</span>
                                                    </div>
                                                    <div className="bg-card px-2 py-1 rounded-lg">
                                                        <span className="text-orange-500 font-bold">{game.homeScore}</span>
                                                        <span className="text-slate-500 mx-1">-</span>
                                                        <span className="text-white font-bold">{game.guestScore}</span>
                                                    </div>
                                                    {game.status === 'live' && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-1 rounded">LIVE</span>
                                                    )}
                                                    {game.status === 'scheduled' && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-1 rounded">UPCOMING</span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-mono text-slate-500">
                                                    {new Date(game.createdAt).toLocaleDateString()}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-slate-500 text-sm italic">No games played yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Teams</h3>
                            <button
                                onClick={() => router.push('/teams')}
                                className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                            >
                                Create New Team
                            </button>
                        </div>

                        {communityTeams.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {communityTeams.map((team) => {
                                    const teamSeasons = team.teamSeasons || [];
                                    const isExpanded = expandedTeamId === team.id;
                                    return (
                                        <div 
                                            key={team.id}
                                            className="bg-input border border-border p-6 rounded-2xl hover:border-orange-500/50 transition-all group relative overflow-hidden"
                                        >
                                            <div 
                                                onClick={() => router.push(`/teams/${team.id}`)}
                                                className="cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="text-4xl font-black font-mono text-slate-700 group-hover:text-orange-500 transition-colors">
                                                        {team.shortCode || team.name.substring(0, 3).toUpperCase()}
                                                    </div>
                                                    {team.color && (
                                                        <div 
                                                            className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]"
                                                            style={{ backgroundColor: team.color, color: team.color }} 
                                                        />
                                                    )}
                                                </div>
                                                
                                                <h3 className="text-lg font-bold group-hover:text-white transition-colors truncate">{team.name}</h3>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Created {new Date(team.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            
                                            {/* Seasons Section */}
                                            <div className="mt-4 pt-4 border-t border-border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs uppercase tracking-wider text-slate-500">Seasons</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedTeamId(isExpanded ? null : team.id);
                                                        }}
                                                        className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                                                    >
                                                        {isExpanded ? 'Close' : 'Manage'}
                                                    </button>
                                                </div>
                                                
                                                {teamSeasons.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                                {teamSeasons.map((ts: TeamSeason) => (
                                                            <span 
                                                                key={ts.id}
                                                                className="text-[10px] px-2 py-1 rounded-full bg-orange-500/20 text-orange-500"
                                                            >
                                                                {ts.season?.name || 'Unknown Season'}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-600 italic">Not assigned to any season</span>
                                                )}
                                                
                                                {/* Expandable Management Section */}
                                                {isExpanded && isAdmin && (
                                                    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                        {/* Current seasons with remove button */}
                                                        {teamSeasons.length > 0 && (
                                                            <div className="space-y-1">
                                                    {teamSeasons.map((ts: TeamSeason) => (
                                                                    <div key={ts.id} className="flex items-center justify-between bg-card/50 px-2 py-1 rounded">
                                                                        <span className="text-xs">{ts.season?.name}</span>
                                                                        <button
                                                                            onClick={() => handleRemoveTeamFromSeason(team.id, ts.seasonId)}
                                                                            className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Add to season */}
                                                        <div className="flex gap-2 pt-2">
                                                            <select
                                                                value={selectedTeamForSeason === team.id ? selectedSeasonForTeam : ''}
                                                                onChange={(e) => {
                                                                    setSelectedTeamForSeason(team.id);
                                                                    setSelectedSeasonForTeam(e.target.value);
                                                                }}
                                                                className="flex-1 text-xs bg-card border border-border rounded-lg px-2 py-1.5"
                                                            >
                                                                <option value="">Add to season...</option>
                                                                {communitySeasons
                                                                    .filter((s: Season) => !teamSeasons.some((ts: TeamSeason) => ts.seasonId === s.id))
                                                                    .map((season: Season) => (
                                                                        <option key={season.id} value={season.id}>
                                                                            {season.name} ({season.status})
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <button
                                                                onClick={() => {
                                                                    if (selectedTeamForSeason === team.id && selectedSeasonForTeam) {
                                                                        handleAddTeamToSeason(team.id, selectedSeasonForTeam);
                                                                    }
                                                                }}
                                                                disabled={selectedTeamForSeason !== team.id || !selectedSeasonForTeam || isAddingTeamToSeason}
                                                                className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isAddingTeamToSeason && selectedTeamForSeason === team.id ? 'Adding...' : 'Add'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-input/50 border border-border border-dashed rounded-2xl p-12 text-center">
                                <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
                                <h3 className="text-lg font-bold text-slate-400 mb-2">No Teams Yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                    Teams created by community members will appear here.
                                </p>
                                <button
                                    onClick={() => router.push('/teams')}
                                    className="bg-card hover:bg-muted text-white font-bold px-6 py-3 rounded-xl transition-colors"
                                >
                                    Create Your First Team
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'seasons' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Seasons</h3>
                            {isAdmin && (
                                <button
                                    onClick={() => setShowSeasonForm(!showSeasonForm)}
                                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                                >
                                    {showSeasonForm ? 'Cancel' : 'Create Season'}
                                </button>
                            )}
                        </div>

                        {showSeasonForm && isAdmin && (
                            <div className="bg-input border border-border rounded-2xl p-6">
                                <h4 className="font-bold mb-4">New Season</h4>
                                <form onSubmit={handleCreateSeason} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Season Name</label>
                                            <input
                                                type="text"
                                                value={newSeason.name}
                                                onChange={e => setNewSeason({ ...newSeason, name: e.target.value })}
                                                placeholder="e.g. 2025 Winter Season"
                                                className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Start Date</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={newSeason.startDate}
                                                    onChange={e => setNewSeason({ ...newSeason, startDate: e.target.value })}
                                                    className="w-full bg-background border border-border rounded-xl px-4 py-2 pr-10 focus:outline-none focus:border-orange-500 appearance-none"
                                                    required
                                                />
                                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">End Date</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={newSeason.endDate}
                                                    min={newSeason.startDate}
                                                    onChange={e => setNewSeason({ ...newSeason, endDate: e.target.value })}
                                                    className="w-full bg-background border border-border rounded-xl px-4 py-2 pr-10 focus:outline-none focus:border-orange-500 appearance-none"
                                                    required
                                                />
                                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Description (Optional)</label>
                                            <textarea
                                                value={newSeason.description}
                                                onChange={e => setNewSeason({ ...newSeason, description: e.target.value })}
                                                className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 h-24"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isCreatingSeason}
                                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        {isCreatingSeason ? 'Creating...' : 'Create Season'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {communitySeasons.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {communitySeasons.map((season) => (
                                    <div 
                                        key={season.id}
                                        className="bg-input border border-border p-6 rounded-2xl hover:border-orange-500/50 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                                                season.status === 'active' ? "bg-green-500/20 text-green-500" :
                                                season.status === 'completed' ? "bg-blue-500/20 text-blue-500" :
                                                season.status === 'archived' ? "bg-slate-500/20 text-slate-500" :
                                                "bg-yellow-500/20 text-yellow-500"
                                            )}>
                                                {season.status}
                                            </span>
                                        </div>
                                        
                                        <h3 className="text-lg font-bold group-hover:text-white transition-colors truncate">{season.name}</h3>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                                        </div>
                                        {season.description && (
                                            <p className="text-xs text-slate-500 mt-3 line-clamp-2">{season.description}</p>
                                        )}
                                        
                                        {/* Teams in this Season */}
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                    <Trophy size={14} />
                                                    <span>{season.teamSeasons?.length || 0} Teams</span>
                                                </div>
                                                {isAdmin && (
                                                    <span className="text-[10px] text-orange-500 uppercase tracking-wider">Manage</span>
                                                )}
                                            </div>
                                            
                                            {/* List of teams in season */}
                                            {season.teamSeasons && season.teamSeasons.length > 0 ? (
                                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                                    {season.teamSeasons.map((ts) => (
                                                        <div key={ts.id} className="flex items-center justify-between bg-card/50 px-3 py-2 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <div 
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: ts.team?.color || '#666' }}
                                                                />
                                                                <span className="text-xs font-medium truncate">{ts.team?.name || 'Unknown Team'}</span>
                                                            </div>
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!confirm(`Remove ${ts.team?.name || 'this team'} from the season?`)) return;
                                                                        const res = await fetch(`/api/seasons/${season.id}/teams?teamId=${ts.teamId}`, {
                                                                            method: 'DELETE',
                                                                        });
                                                                        if (res.ok) {
                                                                            fetch(`/api/communities/${id}`)
                                                                                .then(res => res.json())
                                                                                .then(data => {
                                                                                    setCommunity(data);
                                                                                    setCommunitySeasons(data.seasons || []);
                                                                                    setCommunityTeams(data.teams || []);
                                                                                });
                                                                        } else {
                                                                            const data = await res.json();
                                                                            alert(data.error || 'Failed to remove team');
                                                                        }
                                                                    }}
                                                                    className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-600 italic py-2">No teams assigned to this season yet</div>
                                            )}
                                            
                                            {/* Add Team Section */}
                                            {isAdmin && (
                                                <div className="mt-3 pt-3 border-t border-border/50">
                                                    <div className="flex gap-2">
                                                        <select
                                                            onChange={async (e) => {
                                                                const teamId = e.target.value;
                                                                if (!teamId) return;
                                                                
                                                                const res = await fetch(`/api/seasons/${season.id}/teams`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ teamId }),
                                                                });
                                                                
                                                                if (res.ok) {
                                                                    fetch(`/api/communities/${id}`)
                                                                        .then(res => res.json())
                                                                        .then(data => {
                                                                            setCommunity(data);
                                                                            setCommunitySeasons(data.seasons || []);
                                                                            setCommunityTeams(data.teams || []);
                                                                        });
                                                                } else {
                                                                    const data = await res.json();
                                                                    alert(data.error || 'Failed to add team');
                                                                }
                                                                e.target.value = '';
                                                            }}
                                                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs"
                                                        >
                                                            <option value="">+ Add team to season...</option>
                                                            {communityTeams
                                                                .filter((t: Team) => !season.teamSeasons?.some((ts: TeamSeason) => ts.teamId === t.id))
                                                                .map((team: Team) => (
                                                                    <option key={team.id} value={team.id}>{team.name}</option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-input/50 border border-border border-dashed rounded-2xl p-12 text-center">
                                <Calendar size={48} className="mx-auto text-slate-700 mb-4" />
                                <h3 className="text-lg font-bold text-slate-400 mb-2">No Seasons Yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                    Create seasons to organize teams and track performance over time.
                                </p>
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowSeasonForm(true)}
                                        className="bg-card hover:bg-muted text-white font-bold px-6 py-3 rounded-xl transition-colors"
                                    >
                                        Create Your First Season
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tournaments' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Tournaments</h3>
                            <button
                                onClick={() => router.push(`/communities/${id}/tournaments/create`)}
                                className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                            >
                                Create Tournament
                            </button>
                        </div>

                        {tournamentsLoading ? (
                            <div className="text-center py-12 text-slate-500">Loading tournaments...</div>
                        ) : communityTournaments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {communityTournaments.map((tournament) => (
                                    <div 
                                        key={tournament.id}
                                        onClick={() => router.push(`/tournaments/${tournament.id}`)}
                                        className="bg-input border border-border p-6 rounded-2xl cursor-pointer hover:border-orange-500/50 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                                                tournament.status === 'active' ? "bg-green-500/20 text-green-500" :
                                                tournament.status === 'completed' ? "bg-blue-500/20 text-blue-500" :
                                                "bg-yellow-500/20 text-yellow-500"
                                            )}>
                                                {tournament.status}
                                            </span>
                                            <div className="text-xs text-slate-500">
                                                {tournament.type.replace('_', ' ')}
                                            </div>
                                        </div>
                                        
                                        <h3 className="text-lg font-bold group-hover:text-white transition-colors truncate">{tournament.name}</h3>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                                            <Trophy size={14} />
                                            <span>{tournament.teams?.length || 0} Teams</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-input/50 border border-border border-dashed rounded-2xl p-12 text-center">
                                <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
                                <h3 className="text-lg font-bold text-slate-400 mb-2">No Tournaments Yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                    Organize round robins, knockout brackets, and more.
                                </p>
                                <button
                                    onClick={() => router.push(`/communities/${id}/tournaments/create`)}
                                    className="bg-card hover:bg-muted text-white font-bold px-6 py-3 rounded-xl transition-colors"
                                >
                                    Create Your First Tournament
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-8">
                        <div className="flex gap-4 border-b border-border">
                            <button 
                                onClick={() => setMemberTab('users')}
                                className={cn("pb-2 px-1 text-sm font-bold uppercase tracking-widest transition-all", memberTab === 'users' ? "text-orange-500 border-b-2 border-orange-500" : "text-slate-500")}
                            >
                                Community Staff
                            </button>
                            <button 
                                onClick={() => setMemberTab('athletes')}
                                className={cn("pb-2 px-1 text-sm font-bold uppercase tracking-widest transition-all", memberTab === 'athletes' ? "text-orange-500 border-b-2 border-orange-500" : "text-slate-500")}
                            >
                                Athletes
                            </button>
                        </div>

                        {memberTab === 'users' ? (
                            <>
                                {/* Invite Section (Admin Only) */}
                                {isAdmin && (
                                    <div className="bg-input border border-border rounded-2xl p-6">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <Mail size={20} className="text-orange-500" />
                                            Invite Staff Member
                                        </h3>
                                        
                                        {!inviteLink ? (
                                            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
                                                <input
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    placeholder="Enter email address"
                                                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                                    required
                                                />
                                                <select
                                                    value={inviteRole}
                                                    onChange={(e) => setInviteRole(e.target.value)}
                                                    className="bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                                >
                                                    <option value="scorer">Scorer</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="viewer">Viewer</option>
                                                </select>
                                                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                                                    Generate Link
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="bg-background border border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                                                <div className="flex-1 font-mono text-xs sm:text-sm break-all text-orange-500">
                                                    {inviteLink}
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(inviteLink);
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }}
                                                        className="flex-1 sm:flex-none bg-card hover:bg-muted text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                                        {copied ? 'Copied' : 'Copy'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setInviteLink('');
                                                            setInviteEmail('');
                                                        }}
                                                        className="flex-1 sm:flex-none bg-card hover:bg-muted text-white px-4 py-2 rounded-lg text-sm font-bold"
                                                    >
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Members List */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {community.members.map((member: CommunityMember) => (
                                        <div key={member.id} className="bg-input border border-border p-4 rounded-xl flex items-center justify-between group hover:border-border transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                                    member.role === 'admin' ? "bg-orange-500/20 text-orange-500" : 
                                                    member.role === 'scorer' ? "bg-blue-500/20 text-blue-500" : "bg-card text-slate-500"
                                                )}>
                                                    {member.role === 'admin' ? <Shield size={18} /> : 
                                                     member.role === 'scorer' ? <ShieldAlert size={18} /> : <Eye size={18} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm truncate max-w-[180px]">{member.displayName}</div>
                                                    {member.userEmail && (
                                                        <div className="text-xs text-slate-500 truncate max-w-[180px]">{member.userEmail}</div>
                                                    )}
                                                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{member.role}</div>
                                                </div>
                                            </div>
{isAdmin && member.userId !== userId && (
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {member.role !== 'admin' && (
                                                        <button
                                                            onClick={() => handleChangeRole(member.userId, 'admin')}
                                                            className="text-orange-500 hover:text-orange-400 text-[10px] font-bold uppercase"
                                                        >
                                                            Make Admin
                                                        </button>
                                                    )}
                                                    {member.role !== 'scorer' && (
                                                        <button
                                                            onClick={() => handleChangeRole(member.userId, 'scorer')}
                                                            className="text-blue-500 hover:text-blue-400 text-[10px] font-bold uppercase"
                                                        >
                                                            Make Scorer
                                                        </button>
                                                    )}
                                                    {member.role !== 'viewer' && (
                                                        <button
                                                            onClick={() => handleChangeRole(member.userId, 'viewer')}
                                                            className="text-slate-400 hover:text-slate-300 text-[10px] font-bold uppercase"
                                                        >
                                                            Make Viewer
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveMember(member.userId, member.displayName)}
                                                        className="text-slate-600 hover:text-red-500 text-[10px] font-bold uppercase"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-input border border-border rounded-2xl p-6">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Trophy size={20} className="text-orange-500" />
                                        Invite Athlete to Claim Profile
                                    </h3>
                                    <form 
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const form = e.target as HTMLFormElement;
                                            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                                            const athleteId = (form.elements.namedItem('athleteId') as HTMLSelectElement).value;
                                            
                                            try {
                                                const res = await fetch('/api/players/invite', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email, athleteId }),
                                                });
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    alert(`Invitation generated! Link: ${data.invitationLink}`);
                                                    form.reset();
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        className="flex flex-col sm:flex-row gap-4"
                                    >
                                        <select
                                            name="athleteId"
                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                            required
                                        >
                                            <option value="">Select athlete...</option>
                                            {community.teams?.flatMap((t: Team) => t.memberships || []).map((m) => (
                                                <option key={m.id} value={m.athleteId}>{m.athlete?.name || 'Unknown'}</option>
                                            ))}
                                        </select>
                                        <input
                                            name="email"
                                            type="email"
                                            placeholder="Athlete's email"
                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                            required
                                        />
                                        <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                                            Send Invite
                                        </button>
                                    </form>
                                </div>
                                
                                <p className="text-sm text-slate-500 italic">
                                    This list shows athletes currently assigned to teams in this community.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="text-center py-12 text-slate-500 italic">
                        Community settings coming soon...
                    </div>
                )}

                {activeTab === 'deleted-games' && (
                    <div className="space-y-6">
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Trash2 className="text-red-500" size={20} />
                                Deleted Games
                            </h3>
                            
                            {deletedGamesLoading ? (
                                <div className="text-center py-8 text-slate-500">Loading deleted games...</div>
                            ) : deletedGames.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 italic">No deleted games found.</div>
                            ) : (
                                <div className="space-y-3">
                                    {deletedGames.map((game: DeletedGame) => (
                                        <div key={game.id} className="flex justify-between items-center bg-background p-3 rounded-xl border border-border">
                                            <div>
                                                <div className="font-bold text-sm">
                                                    <span className="text-orange-500">{game.homeTeamName}</span>
                                                    <span className="text-slate-500 mx-2">vs</span>
                                                    <span className="text-white">{game.guestTeamName}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Score: {game.homeScore} - {game.guestScore} | Deleted: {new Date(game.deletedAt).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    by {game.ownerName}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestoreGame(game.id)}
                                                className="bg-green-600/20 hover:bg-green-600/30 text-green-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-colors"
                                            >
                                                <RotateCcw size={12} />
                                                Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
