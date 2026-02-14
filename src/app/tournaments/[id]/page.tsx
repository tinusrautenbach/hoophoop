'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Calendar, Users, Layout, Settings, Plus, X, Search, Trash2, Edit2, Check } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Team = {
    id: string;
    name: string;
    shortCode: string | null;
    color: string | null;
};

type TournamentTeam = {
    id: string;
    teamId: string;
    team: Team;
    seed: number | null;
    poolId: string | null;
    pool: { id: string; name: string } | null;
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    status: 'scheduled' | 'live' | 'final';
    scheduledDate: string | null;
};

type TournamentGame = {
    id: string;
    gameId: string;
    game: Game;
    round: number | null;
    poolId: string | null;
    pool: { id: string; name: string } | null;
    bracketPosition: string | null;
    isPoolGame: boolean;
    // Optional statistics
    homeFouls: number | null;
    guestFouls: number | null;
    playerOfTheMatchId: string | null;
    playerOfTheMatchName: string | null;
    playerOfTheMatch: { id: string; firstName: string; surname: string } | null;
    home3Pointers: number | null;
    guest3Pointers: number | null;
    homeFreeThrows: number | null;
    guestFreeThrows: number | null;
};

type Tournament = {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    description: string | null;
    ownerId: string;
    communityId: string;
    community: { name: string } | null;
    teams: TournamentTeam[];
    games: TournamentGame[];
    pools: { id: string; name: string; teamsAdvancing: number }[];
};

export default function TournamentDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { userId } = useAuth();
    
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'games' | 'standings' | 'bracket' | 'awards'>('overview');
    
    // Teams tab state
    const [showAddTeamModal, setShowAddTeamModal] = useState(false);
    const [teamSearchQuery, setTeamSearchQuery] = useState('');
    const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
    const [searchingTeams, setSearchingTeams] = useState(false);
    const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
    const [editSeed, setEditSeed] = useState('');
    const [showCreateTeamForm, setShowCreateTeamForm] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamShortCode, setNewTeamShortCode] = useState('');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>('tournament_only');
    const [userCommunities, setUserCommunities] = useState<{id: string; name: string}[]>([]);
    
    // Games tab state
    const [showAddGameModal, setShowAddGameModal] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState('');
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [searchingGames, setSearchingGames] = useState(false);
    const [homeTeamId, setHomeTeamId] = useState('');
    const [guestTeamId, setGuestTeamId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [isPoolGame, setIsPoolGame] = useState(true);
    const [selectedPoolId, setSelectedPoolId] = useState('');
    
    // Game stats editing state
    const [editingGameStats, setEditingGameStats] = useState<TournamentGame | null>(null);
    const [editHomeFouls, setEditHomeFouls] = useState('');
    const [editGuestFouls, setEditGuestFouls] = useState('');
    const [editHome3Pointers, setEditHome3Pointers] = useState('');
    const [editGuest3Pointers, setEditGuest3Pointers] = useState('');
    const [editHomeFreeThrows, setEditHomeFreeThrows] = useState('');
    const [editGuestFreeThrows, setEditGuestFreeThrows] = useState('');
    const [editPlayerOfMatchId, setEditPlayerOfMatchId] = useState('');
    const [editPlayerOfMatchName, setEditPlayerOfMatchName] = useState('');
    const [mvpSearchQuery, setMvpSearchQuery] = useState('');
    const [mvpSearchResults, setMvpSearchResults] = useState<{id: string; firstName: string; surname: string; teamName: string}[]>([]);
    const [showMvpSearchResults, setShowMvpSearchResults] = useState(false);

    const fetchTournament = async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/tournaments/${id}`);
            if (res.ok) {
                const data = await res.json();
                setTournament(data);
            } else {
                router.push('/communities');
            }
        } catch (err) {
            console.error(err);
            router.push('/communities');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTournament();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Fetch user communities when add team modal opens
    useEffect(() => {
        if (showAddTeamModal && userCommunities.length === 0) {
            fetch('/api/communities')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setUserCommunities(data);
                    }
                })
                .catch(err => console.error('Error fetching communities:', err));
        }
    }, [showAddTeamModal, userCommunities.length]);

    // Search teams when query changes
    useEffect(() => {
        if (!teamSearchQuery.trim() || !showAddTeamModal) return;
        
        const timeout = setTimeout(async () => {
            setSearchingTeams(true);
            try {
                const res = await fetch(`/api/teams?q=${encodeURIComponent(teamSearchQuery)}&communityId=${tournament?.communityId}`);
                if (res.ok) {
                    const data = await res.json();
                    // Filter out teams already in tournament
                    const existingTeamIds = new Set(tournament?.teams.map(t => t.teamId) || []);
                    const filtered = (Array.isArray(data) ? data : data.teams || []).filter((t: Team) => !existingTeamIds.has(t.id));
                    setAvailableTeams(filtered);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setSearchingTeams(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [teamSearchQuery, showAddTeamModal, tournament?.teams, tournament?.communityId]);

    // Search games when query changes
    useEffect(() => {
        if (!gameSearchQuery.trim() || !showAddGameModal || activeTab !== 'games') return;
        
        const timeout = setTimeout(async () => {
            setSearchingGames(true);
            try {
                const res = await fetch(`/api/games?q=${encodeURIComponent(gameSearchQuery)}`);
                if (res.ok) {
                    const data = await res.json();
                    // Filter out games already in tournament
                    const existingGameIds = new Set(tournament?.games.map(g => g.gameId) || []);
                    const filtered = (data || []).filter((g: Game) => !existingGameIds.has(g.id));
                    setAvailableGames(filtered);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setSearchingGames(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [gameSearchQuery, showAddGameModal, tournament?.games, activeTab]);

    const handleAddTeam = async (team: Team, poolId?: string) => {
        try {
            const res = await fetch(`/api/tournaments/${id}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    teamId: team.id,
                    poolId: poolId || null 
                }),
            });

            if (res.ok) {
                await fetchTournament();
                setShowAddTeamModal(false);
                setTeamSearchQuery('');
                setAvailableTeams([]);
                setShowCreateTeamForm(false);
                setNewTeamName('');
                setNewTeamShortCode('');
                setSelectedCommunityId('tournament_only');
                setSelectedPoolId('');
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to add team');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to add team');
        }
    };

    const handleCreateAndAddTeam = async () => {
        if (!newTeamName.trim()) {
            alert('Please enter a team name');
            return;
        }

        setCreatingTeam(true);
        try {
            // Determine community ID - 'tournament_only' means no community
            const communityId = selectedCommunityId === 'tournament_only' ? null : selectedCommunityId;
            
            // First create the team
            const createRes = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newTeamName.trim(),
                    shortCode: newTeamShortCode.trim() || undefined,
                    communityId: communityId,
                }),
            });

            if (!createRes.ok) {
                const error = await createRes.json();
                alert(error.error || 'Failed to create team');
                return;
            }

            const newTeam = await createRes.json();
            
            // Then add it to the tournament with pool
            await handleAddTeam(newTeam, selectedPoolId);
        } catch (err) {
            console.error(err);
            alert('Failed to create and add team');
        } finally {
            setCreatingTeam(false);
        }
    };

    const handleRemoveTeam = async (teamId: string) => {
        if (!confirm('Are you sure you want to remove this team from the tournament?')) return;
        
        try {
            const res = await fetch(`/api/tournaments/${id}/teams/${teamId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                await fetchTournament();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to remove team');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to remove team');
        }
    };

    const handleUpdateSeed = async (tournamentTeamId: string) => {
        try {
            const res = await fetch(`/api/tournaments/${id}/teams/${tournamentTeamId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed: editSeed ? parseInt(editSeed) : null }),
            });

            if (res.ok) {
                await fetchTournament();
                setEditingTeam(null);
                setEditSeed('');
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to update seed');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update seed');
        }
    };

    const handleCreateGame = async () => {
        if (!homeTeamId || !guestTeamId) {
            alert('Please select both home and guest teams');
            return;
        }

        try {
            const res = await fetch(`/api/tournaments/${id}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeamId,
                    guestTeamId,
                    scheduledDate: scheduledDate || null,
                    isPoolGame,
                    poolId: selectedPoolId || null,
                }),
            });

            if (res.ok) {
                await fetchTournament();
                setShowAddGameModal(false);
                setHomeTeamId('');
                setGuestTeamId('');
                setScheduledDate('');
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create game');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create game');
        }
    };

    const handleLinkGame = async (game: Game) => {
        try {
            const res = await fetch(`/api/tournaments/${id}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: game.id,
                    isPoolGame,
                    poolId: selectedPoolId || null,
                }),
            });

            if (res.ok) {
                await fetchTournament();
                setShowAddGameModal(false);
                setGameSearchQuery('');
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to link game');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to link game');
        }
    };

    const handleRemoveGame = async (tournamentGameId: string) => {
        if (!confirm('Are you sure you want to remove this game from the tournament?')) return;
        
        try {
            const res = await fetch(`/api/tournaments/${id}/games/${tournamentGameId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                await fetchTournament();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to remove game');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to remove game');
        }
    };

    const openGameStatsEditor = (tg: TournamentGame) => {
        setEditingGameStats(tg);
        setEditHomeFouls(tg.homeFouls?.toString() || '');
        setEditGuestFouls(tg.guestFouls?.toString() || '');
        setEditHome3Pointers(tg.home3Pointers?.toString() || '');
        setEditGuest3Pointers(tg.guest3Pointers?.toString() || '');
        setEditHomeFreeThrows(tg.homeFreeThrows?.toString() || '');
        setEditGuestFreeThrows(tg.guestFreeThrows?.toString() || '');
        setEditPlayerOfMatchId(tg.playerOfTheMatchId || '');
        setEditPlayerOfMatchName(tg.playerOfTheMatchName || tg.playerOfTheMatch?.firstName + ' ' + tg.playerOfTheMatch?.surname || '');
        setMvpSearchQuery('');
        setMvpSearchResults([]);
        setShowMvpSearchResults(false);
    };

    const searchMvpPlayers = async (query: string) => {
        if (!query.trim() || !editingGameStats) return;
        
        try {
            // Fetch players from both teams using their memberships
            const homeTeamId = tournament?.teams.find(t => t.team.name === editingGameStats.game.homeTeamName)?.teamId;
            const guestTeamId = tournament?.teams.find(t => t.team.name === editingGameStats.game.guestTeamName)?.teamId;
            
            if (!homeTeamId || !guestTeamId) return;
            
            // Fetch players from both teams
            const [homeRes, guestRes] = await Promise.all([
                fetch(`/api/teams/${homeTeamId}/members`),
                fetch(`/api/teams/${guestTeamId}/members`)
            ]);
            
            if (homeRes.ok && guestRes.ok) {
                const homePlayers = await homeRes.json();
                const guestPlayers = await guestRes.json();
                
                type PlayerMembership = {
                    athlete: {
                        id: string;
                        firstName: string | null;
                        surname: string | null;
                    };
                    teamName: string;
                };
                
                // Combine and filter by search query
                const allPlayers: PlayerMembership[] = [
                    ...(homePlayers || []).map((p: { athlete: { id: string; firstName: string | null; surname: string | null } }) => ({ ...p, teamName: editingGameStats.game.homeTeamName })),
                    ...(guestPlayers || []).map((p: { athlete: { id: string; firstName: string | null; surname: string | null } }) => ({ ...p, teamName: editingGameStats.game.guestTeamName }))
                ];
                
                const filtered = allPlayers.filter((p) => {
                    const firstName = p.athlete.firstName || '';
                    const surname = p.athlete.surname || '';
                    return firstName.toLowerCase().includes(query.toLowerCase()) ||
                           surname.toLowerCase().includes(query.toLowerCase());
                });
                
                setMvpSearchResults(filtered.map((p) => ({
                    id: p.athlete.id,
                    firstName: p.athlete.firstName || '',
                    surname: p.athlete.surname || '',
                    teamName: p.teamName
                })));
                setShowMvpSearchResults(true);
            }
        } catch (err) {
            console.error('Error searching players:', err);
        }
    };

    const closeGameStatsEditor = () => {
        setEditingGameStats(null);
        setEditHomeFouls('');
        setEditGuestFouls('');
        setEditHome3Pointers('');
        setEditGuest3Pointers('');
        setEditHomeFreeThrows('');
        setEditGuestFreeThrows('');
        setEditPlayerOfMatchId('');
        setEditPlayerOfMatchName('');
        setMvpSearchQuery('');
        setMvpSearchResults([]);
        setShowMvpSearchResults(false);
    };

    const handleSaveGameStats = async () => {
        if (!editingGameStats) return;

        try {
            await handleManualScoreEntry(
                editingGameStats.gameId,
                editingGameStats.game.homeScore,
                editingGameStats.game.guestScore,
                {
                    homeFouls: editHomeFouls ? parseInt(editHomeFouls) : undefined,
                    guestFouls: editGuestFouls ? parseInt(editGuestFouls) : undefined,
                    home3Pointers: editHome3Pointers ? parseInt(editHome3Pointers) : undefined,
                    guest3Pointers: editGuest3Pointers ? parseInt(editGuest3Pointers) : undefined,
                    homeFreeThrows: editHomeFreeThrows ? parseInt(editHomeFreeThrows) : undefined,
                    guestFreeThrows: editGuestFreeThrows ? parseInt(editGuestFreeThrows) : undefined,
                    playerOfTheMatchId: editPlayerOfMatchId || undefined,
                    playerOfTheMatchName: editPlayerOfMatchName?.trim() || undefined,
                }
            );
            closeGameStatsEditor();
        } catch (err) {
            console.error(err);
        }
    };

    const handleManualScoreEntry = async (
        gameId: string, 
        homeScore: number, 
        guestScore: number,
        extraStats?: {
            homeFouls?: number;
            guestFouls?: number;
            playerOfTheMatchId?: string;
            playerOfTheMatchName?: string;
            home3Pointers?: number;
            guest3Pointers?: number;
            homeFreeThrows?: number;
            guestFreeThrows?: number;
        }
    ) => {
        try {
            const res = await fetch(`/api/tournaments/${id}/games/${gameId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    homeScore, 
                    guestScore,
                    ...extraStats
                }),
            });

            if (res.ok) {
                await fetchTournament();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to update score');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update score');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading tournament...</div>;
    if (!tournament) return null;

    const isOwner = tournament.ownerId === userId;

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <button 
                onClick={() => router.back()} 
                className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
            >
                <ArrowLeft size={20} />
                Back
            </button>

            {/* Header */}
            <div className="bg-input border border-border rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                            tournament.status === 'active' ? "bg-green-500/20 text-green-500" :
                            tournament.status === 'completed' ? "bg-blue-500/20 text-blue-500" :
                            "bg-yellow-500/20 text-yellow-500"
                        )}>
                            {tournament.status}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-500/10 text-orange-500 px-2 py-1 rounded">
                            {tournament.type.replace('_', ' ')}
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">{tournament.name}</h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 text-sm">
                        <div className="flex items-center gap-1">
                            <Calendar size={16} />
                            <span>{new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Users size={16} />
                            <span>{tournament.teams?.length || 0} Teams</span>
                        </div>
                        {tournament.community && (
                            <div className="flex items-center gap-1">
                                <Layout size={16} />
                                <span>{tournament.community.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                {isOwner && (
                    <div className="flex gap-2">
                        <button className="bg-card hover:bg-muted text-white p-3 rounded-xl transition-colors">
                            <Settings size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border gap-6 overflow-x-auto">
                {['overview', 'teams', 'games', 'standings', 'bracket', 'awards'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as 'overview' | 'teams' | 'games' | 'standings' | 'bracket' | 'awards')}
                        className={cn(
                            "pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                            activeTab === tab
                                ? "text-orange-500 border-b-2 border-orange-500"
                                : "text-slate-500 hover:text-white"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">Description</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {tournament.description || "No description provided."}
                            </p>
                        </div>
                        
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">Quick Stats</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-background p-4 rounded-xl border border-border text-center">
                                    <div className="text-2xl font-black text-white">{tournament.teams?.length || 0}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500">Teams</div>
                                </div>
                                <div className="bg-background p-4 rounded-xl border border-border text-center">
                                    <div className="text-2xl font-black text-white">{tournament.games?.length || 0}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500">Games</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Participating Teams</h3>
                            {isOwner && (
                                <button 
                                    onClick={() => setShowAddTeamModal(true)}
                                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add Team
                                </button>
                            )}
                        </div>
                        
                        {tournament.teams?.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tournament.teams.map((t) => (
                                    <div key={t.id} className="bg-input border border-border p-4 rounded-xl flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
                                                style={{ 
                                                    backgroundColor: t.team.color || '#334155',
                                                    color: t.team.color ? '#fff' : '#fb923c'
                                                }}
                                            >
                                                {t.team.shortCode || t.team.name.substring(0, 3).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm truncate">{t.team.name}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500">
                                                        Seed #{t.seed || 'N/A'}
                                                    </span>
                                                    {t.pool && (
                                                        <span className="text-[10px] uppercase font-bold text-orange-500">
                                                            {t.pool.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isOwner && (
                                            <div className="flex items-center gap-1">
                                                {editingTeam?.id === t.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editSeed}
                                                            onChange={(e) => setEditSeed(e.target.value)}
                                                            placeholder="#"
                                                            className="w-12 bg-background border border-border rounded px-2 py-1 text-sm"
                                                        />
                                                        <button 
                                                            onClick={() => handleUpdateSeed(t.teamId)}
                                                            className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => { setEditingTeam(null); setEditSeed(''); }}
                                                            className="p-1 text-slate-500 hover:bg-slate-500/10 rounded"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={() => { setEditingTeam(t); setEditSeed(t.seed?.toString() || ''); }}
                                                            className="p-2 text-slate-500 hover:text-white hover:bg-slate-500/10 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveTeam(t.teamId)}
                                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 italic">No teams added yet.</div>
                        )}
                    </div>
                )}

                {activeTab === 'games' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Tournament Games</h3>
                            {isOwner && (
                                <button 
                                    onClick={() => setShowAddGameModal(true)}
                                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add Game
                                </button>
                            )}
                        </div>
                        
                        {tournament.games?.length > 0 ? (
                            <div className="space-y-3">
                                {tournament.games.map((tg) => (
                                    <div key={tg.id} className="bg-input border border-border p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center min-w-[120px]">
                                                <div className="font-bold">{tg.game.homeTeamName}</div>
                                                {isOwner && tg.game.status === 'scheduled' && (
                                                    <input
                                                        type="number"
                                                        defaultValue={tg.game.homeScore}
                                                        onBlur={(e) => handleManualScoreEntry(tg.gameId, parseInt(e.target.value) || 0, tg.game.guestScore)}
                                                        className="w-16 bg-background border border-border rounded px-2 py-1 text-sm mt-1 text-center"
                                                    />
                                                )}
                                                {(!isOwner || tg.game.status !== 'scheduled') && (
                                                    <div className="text-2xl font-black text-orange-500">{tg.game.homeScore}</div>
                                                )}
                                            </div>
                                            <div className="text-slate-500 font-bold">vs</div>
                                            <div className="text-center min-w-[120px]">
                                                <div className="font-bold">{tg.game.guestTeamName}</div>
                                                {isOwner && tg.game.status === 'scheduled' && (
                                                    <input
                                                        type="number"
                                                        defaultValue={tg.game.guestScore}
                                                        onBlur={(e) => handleManualScoreEntry(tg.gameId, tg.game.homeScore, parseInt(e.target.value) || 0)}
                                                        className="w-16 bg-background border border-border rounded px-2 py-1 text-sm mt-1 text-center"
                                                    />
                                                )}
                                                {(!isOwner || tg.game.status !== 'scheduled') && (
                                                    <div className="text-2xl font-black">{tg.game.guestScore}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase px-2 py-1 rounded",
                                                    tg.game.status === 'live' ? "bg-green-500/20 text-green-500" :
                                                    tg.game.status === 'final' ? "bg-blue-500/20 text-blue-500" :
                                                    "bg-yellow-500/20 text-yellow-500"
                                                )}>
                                                    {tg.game.status}
                                                </span>
                                                {tg.isPoolGame && tg.pool && (
                                                    <div className="text-[10px] text-orange-500 mt-1">{tg.pool.name}</div>
                                                )}
                                                {tg.bracketPosition && (
                                                    <div className="text-[10px] text-slate-500 mt-1">{tg.bracketPosition}</div>
                                                )}
                                                {tg.game.scheduledDate && (
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        {new Date(tg.game.scheduledDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {/* Show stats summary if any exist */}
                                                {(tg.homeFouls !== null || tg.guestFouls !== null || tg.playerOfTheMatch || tg.playerOfTheMatchName) && (
                                                    <div className="mt-2 space-y-1">
                                                        {tg.homeFouls !== null && tg.guestFouls !== null && (
                                                            <div className="text-[10px] text-slate-400">
                                                                Fouls: {tg.homeFouls}-{tg.guestFouls}
                                                            </div>
                                                        )}
                                                        {(tg.playerOfTheMatch || tg.playerOfTheMatchName) && (
                                                            <div className="text-[10px] text-orange-500">
                                                                MVP: {tg.playerOfTheMatch?.firstName} {tg.playerOfTheMatch?.surname || tg.playerOfTheMatchName}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {isOwner && (
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => openGameStatsEditor(tg)}
                                                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-500/10 rounded-lg transition-colors"
                                                        title="Edit game statistics"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRemoveGame(tg.id)}
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 italic">No games added yet.</div>
                        )}
                    </div>
                )}

                {['standings', 'bracket', 'awards'].map(tab => activeTab === tab && (
                    <div key={tab} className="bg-input/50 border border-border border-dashed rounded-2xl p-12 text-center">
                        <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
                        <h3 className="text-lg font-bold text-slate-400 mb-2">{tab.charAt(0).toUpperCase() + tab.slice(1)} Coming Soon</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">
                            We&apos;re still building the {tab} management interface for tournaments.
                        </p>
                    </div>
                ))}
            </div>

            {/* Add Team Modal */}
            {showAddTeamModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add Team to Tournament</h3>
                            <button 
                                onClick={() => { 
                                    setShowAddTeamModal(false); 
                                    setTeamSearchQuery(''); 
                                    setAvailableTeams([]);
                                    setShowCreateTeamForm(false);
                                    setNewTeamName('');
                                    setNewTeamShortCode('');
                                    setSelectedCommunityId('tournament_only');
                                }}
                                className="p-2 hover:bg-slate-500/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Create New Team Section */}
                        {!showCreateTeamForm ? (
                            <button
                                onClick={() => setShowCreateTeamForm(true)}
                                className="w-full mb-4 bg-orange-600/20 border border-orange-500/50 hover:bg-orange-600/30 text-orange-500 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Create New Team
                            </button>
                        ) : (
                            <div className="bg-input/50 border border-border rounded-2xl p-4 mb-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-orange-500">Create New Team</h4>
                                    <button 
                                        onClick={() => {
                                            setShowCreateTeamForm(false);
                                            setNewTeamName('');
                                            setNewTeamShortCode('');
                                            setSelectedCommunityId('tournament_only');
                                        }}
                                        className="text-slate-500 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Team Name *</label>
                                    <input
                                        type="text"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                        placeholder="e.g. The Eagles"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Short Code (optional)</label>
                                    <input
                                        type="text"
                                        value={newTeamShortCode}
                                        onChange={(e) => setNewTeamShortCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. EAG (max 3 chars)"
                                        maxLength={3}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                
                                {/* Community Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Community *</label>
                                    <select
                                        value={selectedCommunityId}
                                        onChange={(e) => setSelectedCommunityId(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                    >
                                        <option value="tournament_only">🏆 Tournament Only (No Community)</option>
                                        <option value="" disabled>────────── Your Communities ──────────</option>
                                        {userCommunities.map((community) => (
                                            <option key={community.id} value={community.id}>
                                                {community.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500">
                                        Tournament-only teams are managed only for this tournament.
                                        Teams in communities can be reused across tournaments.
                                    </p>
                                </div>
                                
                                <button
                                    onClick={handleCreateAndAddTeam}
                                    disabled={!newTeamName.trim() || creatingTeam}
                                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white font-bold py-2 rounded-xl transition-colors"
                                >
                                    {creatingTeam ? 'Creating...' : 'Create & Add to Tournament'}
                                </button>
                            </div>
                        )}

                        {/* Pool Selection for Pool-Based Tournaments */}
                        {tournament && (tournament.type === 'pool_knockout' || tournament.type === 'group_stage' || tournament.type === 'custom') && tournament.pools && tournament.pools.length > 0 && (
                            <div className="mb-4">
                                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">Pool / Group</label>
                                <select
                                    value={selectedPoolId}
                                    onChange={(e) => setSelectedPoolId(e.target.value)}
                                    className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                >
                                    <option value="">Select a pool...</option>
                                    {tournament.pools.map((pool) => (
                                        <option key={pool.id} value={pool.id}>{pool.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Search Divider */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-slate-500 uppercase font-bold">Or Search Existing</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                value={teamSearchQuery}
                                onChange={(e) => setTeamSearchQuery(e.target.value)}
                                placeholder="Search teams..."
                                className="w-full bg-input border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {searchingTeams ? (
                                <div className="text-center py-8 text-slate-500">Searching...</div>
                            ) : availableTeams.length > 0 ? (
                                availableTeams.map((team) => (
                                    <button
                                        key={team.id}
                                        onClick={() => handleAddTeam(team, selectedPoolId)}
                                        className="w-full bg-input border border-border hover:border-orange-500/50 p-3 rounded-xl flex items-center gap-3 transition-colors text-left"
                                    >
                                        <div 
                                            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                                            style={{ 
                                                backgroundColor: team.color || '#334155',
                                                color: team.color ? '#fff' : '#fb923c'
                                            }}
                                        >
                                            {team.shortCode || team.name.substring(0, 3).toUpperCase()}
                                        </div>
                                        <div className="font-medium">{team.name}</div>
                                    </button>
                                ))
                            ) : teamSearchQuery ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 mb-2">No teams found matching &quot;{teamSearchQuery}&quot;</p>
                                    <button
                                        onClick={() => {
                                            setNewTeamName(teamSearchQuery);
                                            setShowCreateTeamForm(true);
                                        }}
                                        className="text-orange-500 hover:text-orange-400 font-bold text-sm"
                                    >
                                        Create new team with this name →
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">Start typing to search for existing teams</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Game Modal */}
            {showAddGameModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add Game to Tournament</h3>
                            <button 
                                onClick={() => { 
                                    setShowAddGameModal(false); 
                                    setGameSearchQuery(''); 
                                    setAvailableGames([]);
                                    setHomeTeamId('');
                                    setGuestTeamId('');
                                }}
                                className="p-2 hover:bg-slate-500/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Option 1: Link existing game */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Link Existing Game</h4>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        value={gameSearchQuery}
                                        onChange={(e) => setGameSearchQuery(e.target.value)}
                                        placeholder="Search games..."
                                        className="w-full bg-input border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                {searchingGames ? (
                                    <div className="text-center py-4 text-slate-500">Searching...</div>
                                ) : availableGames.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {availableGames.map((game) => (
                                            <button
                                                key={game.id}
                                                onClick={() => handleLinkGame(game)}
                                                className="w-full bg-input border border-border hover:border-orange-500/50 p-3 rounded-xl text-left transition-colors"
                                            >
                                                <div className="font-medium">{game.homeTeamName} vs {game.guestTeamName}</div>
                                                <div className="text-xs text-slate-500">
                                                    {game.status} • {game.scheduledDate ? new Date(game.scheduledDate).toLocaleDateString() : 'No date'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : gameSearchQuery ? (
                                    <div className="text-center py-4 text-slate-500 text-sm">No games found</div>
                                ) : null}
                            </div>

                            <div className="border-t border-border" />

                            {/* Option 2: Create new game */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Create New Game</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400">Home Team</label>
                                    <select
                                        value={homeTeamId}
                                        onChange={(e) => setHomeTeamId(e.target.value)}
                                        className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                                    >
                                        <option value="">Select team...</option>
                                        {tournament.teams.map((t) => (
                                            <option key={t.teamId} value={t.teamId}>{t.team.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400">Guest Team</label>
                                    <select
                                        value={guestTeamId}
                                        onChange={(e) => setGuestTeamId(e.target.value)}
                                        className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                                    >
                                        <option value="">Select team...</option>
                                        {tournament.teams.map((t) => (
                                            <option key={t.teamId} value={t.teamId}>{t.team.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400">Scheduled Date</label>
                                    <input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
                                    />
                                </div>

                                {tournament.pools?.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="isPoolGame"
                                                checked={isPoolGame}
                                                onChange={(e) => setIsPoolGame(e.target.checked)}
                                                className="rounded border-border"
                                            />
                                            <label htmlFor="isPoolGame" className="text-sm">Pool Game</label>
                                        </div>
                                        {isPoolGame && (
                                            <select
                                                value={selectedPoolId}
                                                onChange={(e) => setSelectedPoolId(e.target.value)}
                                                className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                                            >
                                                <option value="">Select pool...</option>
                                                {tournament.pools.map((pool) => (
                                                    <option key={pool.id} value={pool.id}>{pool.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </>
                                )}

                                <button
                                    onClick={handleCreateGame}
                                    disabled={!homeTeamId || !guestTeamId}
                                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Create Game
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Game Stats Modal */}
            {editingGameStats && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Game Statistics</h3>
                            <button 
                                onClick={closeGameStatsEditor}
                                className="p-2 hover:bg-slate-500/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-6 text-center">
                            <div className="text-lg font-bold">{editingGameStats.game.homeTeamName} vs {editingGameStats.game.guestTeamName}</div>
                        </div>

                        {/* Score Editing Section */}
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6">
                            <h4 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3 text-center">Final Score</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 text-center block">{editingGameStats.game.homeTeamName}</label>
                                    <input
                                        type="number"
                                        value={editingGameStats.game.homeScore}
                                        onChange={(e) => {
                                            const newScore = parseInt(e.target.value) || 0;
                                            setEditingGameStats({
                                                ...editingGameStats,
                                                game: { ...editingGameStats.game, homeScore: newScore }
                                            });
                                        }}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-center text-2xl font-black text-orange-500 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 text-center block">{editingGameStats.game.guestTeamName}</label>
                                    <input
                                        type="number"
                                        value={editingGameStats.game.guestScore}
                                        onChange={(e) => {
                                            const newScore = parseInt(e.target.value) || 0;
                                            setEditingGameStats({
                                                ...editingGameStats,
                                                game: { ...editingGameStats.game, guestScore: newScore }
                                            });
                                        }}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-center text-2xl font-black focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Fouls Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Fouls (for tiebreakers)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.homeTeamName} Fouls</label>
                                        <input
                                            type="number"
                                            value={editHomeFouls}
                                            onChange={(e) => setEditHomeFouls(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.guestTeamName} Fouls</label>
                                        <input
                                            type="number"
                                            value={editGuestFouls}
                                            onChange={(e) => setEditGuestFouls(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3-Pointers Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-orange-500 uppercase tracking-wider">3-Pointers Made</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.homeTeamName} 3PT</label>
                                        <input
                                            type="number"
                                            value={editHome3Pointers}
                                            onChange={(e) => setEditHome3Pointers(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.guestTeamName} 3PT</label>
                                        <input
                                            type="number"
                                            value={editGuest3Pointers}
                                            onChange={(e) => setEditGuest3Pointers(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Free Throws Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Free Throws Made</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.homeTeamName} FT</label>
                                        <input
                                            type="number"
                                            value={editHomeFreeThrows}
                                            onChange={(e) => setEditHomeFreeThrows(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">{editingGameStats.game.guestTeamName} FT</label>
                                        <input
                                            type="number"
                                            value={editGuestFreeThrows}
                                            onChange={(e) => setEditGuestFreeThrows(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full bg-input border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Player of the Match Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Player of the Match (MVP)</h4>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Search for player or type name</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            value={mvpSearchQuery}
                                            onChange={(e) => {
                                                setMvpSearchQuery(e.target.value);
                                                setEditPlayerOfMatchName(e.target.value);
                                                if (e.target.value.length >= 2) {
                                                    searchMvpPlayers(e.target.value);
                                                } else {
                                                    setShowMvpSearchResults(false);
                                                }
                                            }}
                                            placeholder="Search players from both teams..."
                                            className="w-full bg-input border border-border rounded-xl pl-12 pr-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    
                                    {/* Search Results Dropdown */}
                                    {showMvpSearchResults && mvpSearchResults.length > 0 && (
                                        <div className="bg-background border border-border rounded-xl mt-1 max-h-40 overflow-y-auto">
                                            {mvpSearchResults.map((player) => (
                                                <button
                                                    key={player.id}
                                                    onClick={() => {
                                                        setEditPlayerOfMatchId(player.id);
                                                        setEditPlayerOfMatchName(`${player.firstName} ${player.surname}`);
                                                        setMvpSearchQuery(`${player.firstName} ${player.surname}`);
                                                        setShowMvpSearchResults(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-input transition-colors flex justify-between items-center"
                                                >
                                                    <span>{player.firstName} {player.surname}</span>
                                                    <span className="text-xs text-slate-500">{player.teamName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Show selected MVP */}
                                    {editPlayerOfMatchName && (
                                        <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                                            <div className="text-sm text-slate-400">Selected MVP:</div>
                                            <div className="font-bold text-orange-500">{editPlayerOfMatchName}</div>
                                            {editPlayerOfMatchId && (
                                                <div className="text-xs text-slate-500">Linked to player profile</div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <p className="text-xs text-slate-500 mt-1">
                                        Type at least 2 characters to search players from both teams, or enter any name for MVP.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={closeGameStatsEditor}
                                    className="flex-1 bg-card hover:bg-muted text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveGameStats}
                                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Save Statistics
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
