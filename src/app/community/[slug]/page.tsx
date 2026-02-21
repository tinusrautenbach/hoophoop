'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { GameCard } from '@/app/live/components/game-card';
import { Search, Calendar, Users, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Game {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    homeTimeouts: number;
    guestTimeouts: number;
    totalTimeouts: number;
    currentPeriod: number;
    totalPeriods: number;
    periodSeconds: number;
    clockSeconds: number;
    possession: 'home' | 'guest' | null;
    mode: 'simple' | 'advanced';
    status: 'scheduled' | 'live' | 'final';
    isTimerRunning: boolean;
    communityId?: string;
    homeTeam?: {
        id: string;
        name: string;
        shortCode?: string;
        color?: string;
    } | null;
    guestTeam?: {
        id: string;
        name: string;
        shortCode?: string;
        color?: string;
    } | null;
}

interface Community {
    id: string;
    name: string;
    slug: string;
    type: string;
}

interface Team {
    id: string;
    name: string;
    shortCode?: string;
    color?: string;
    _count?: {
        memberships: number;
    };
}

type TabType = 'live' | 'historical' | 'teams' | 'seasons';

type Season = {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
};

type Standing = {
    teamId: string;
    teamName: string;
    played: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
};

export default function CommunityPage() {
    const params = useParams();
    const slug = params.slug as string;
    
    const [activeTab, setActiveTab] = useState<TabType>('live');
    const [community, setCommunity] = useState<Community | null>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [seasonGames, setSeasonGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Fetch community data and games
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', activeTab === 'live' ? 'live' : activeTab === 'historical' ? 'final' : 'all');
            if (searchQuery) params.set('search', searchQuery);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const response = await fetch(`/api/public/communities/${slug}/games?${params.toString()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setCommunity(null);
                    return;
                }
                throw new Error('Failed to fetch community data');
            }
            
            const data = await response.json();
            setCommunity(data.community);
            setGames(data.games);
        } catch (error) {
            console.error('Error fetching community data:', error);
        } finally {
            setLoading(false);
        }
    }, [slug, activeTab, searchQuery, dateFrom, dateTo]);

    // Fetch teams when teams tab is active
    const fetchTeams = useCallback(async () => {
        if (activeTab !== 'teams' || !community) return;
        
        try {
            const response = await fetch(`/api/communities/${community.id}/teams`);
            if (response.ok) {
                const data = await response.json();
                setTeams(data.teams || []);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    }, [activeTab, community]);

    // Fetch seasons when seasons tab is active
    const fetchSeasons = useCallback(async () => {
        if (activeTab !== 'seasons') return;
        
        try {
            const response = await fetch(`/api/public/communities/${slug}/seasons`);
            if (response.ok) {
                const data = await response.json();
                setSeasons(data.seasons || []);
            }
        } catch (error) {
            console.error('Error fetching seasons:', error);
        }
    }, [activeTab, slug]);

    // Fetch standings and games for selected season
    const fetchSeasonDetails = useCallback(async () => {
        if (!selectedSeasonId) return;
        
        setLoading(true);
        try {
            const [standingsRes, gamesRes] = await Promise.all([
                fetch(`/api/seasons/${selectedSeasonId}/standings`),
                fetch(`/api/seasons/${selectedSeasonId}/games`)
            ]);
            
            if (standingsRes.ok) {
                const data = await standingsRes.json();
                setStandings(data);
            }
            if (gamesRes.ok) {
                const data = await gamesRes.json();
                setSeasonGames(data);
            }
        } catch (error) {
            console.error('Error fetching season details:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedSeasonId]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch teams when tab changes
    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // Fetch seasons when tab changes
    useEffect(() => {
        fetchSeasons();
    }, [fetchSeasons]);

    // Fetch season details when selection changes
    useEffect(() => {
        fetchSeasonDetails();
    }, [fetchSeasonDetails]);

    // Filter games by search
    const filteredGames = games.filter(game => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            game.homeTeamName.toLowerCase().includes(query) ||
            game.guestTeamName.toLowerCase().includes(query) ||
            game.homeTeam?.name?.toLowerCase().includes(query) ||
            game.guestTeam?.name?.toLowerCase().includes(query)
        );
    });

    // Filter teams by search
    const filteredTeams = teams.filter(team => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            team.name.toLowerCase().includes(query) ||
            team.shortCode?.toLowerCase().includes(query)
        );
    });

    if (!community && !loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Community Not Found</h1>
                    <p className="text-slate-400 mb-4">The community you&apos;re looking for doesn&apos;t exist.</p>
                    <Link href="/live" className="text-orange-500 hover:text-orange-400">
                        ← Back to Live Scores
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-input border-b border-border sticky top-16 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    {/* Back Link */}
                    <Link href="/live" className="inline-flex items-center gap-2 text-slate-400 hover:text-orange-400 transition-colors mb-4">
                        <ArrowLeft size={16} />
                        <span className="text-sm">Back to All Live Scores</span>
                    </Link>

                    {/* Community Header */}
                    {community && (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{community.name}</h1>
                                    <span className="text-xs uppercase tracking-wider text-slate-500 bg-card px-2 py-1 rounded">
                                        {community.type}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm">
                                    Live and historical games from this community
                                </p>
                            </div>
                            

                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                activeTab === 'live'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-card text-slate-400 hover:bg-muted'
                            }`}
                        >
                            Live Games
                            {activeTab === 'live' && games.filter(g => g.status === 'live').length > 0 && (
                                <span className="ml-2 bg-orange-700 text-xs px-2 py-0.5 rounded-full">
                                    {games.filter(g => g.status === 'live').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('historical')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                activeTab === 'historical'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-card text-slate-400 hover:bg-muted'
                            }`}
                        >
                            Historical
                            {activeTab === 'historical' && games.filter(g => g.status === 'final').length > 0 && (
                                <span className="ml-2 bg-orange-700 text-xs px-2 py-0.5 rounded-full">
                                    {games.filter(g => g.status === 'final').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('teams')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                activeTab === 'teams'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-card text-slate-400 hover:bg-muted'
                            }`}
                        >
                            <Users size={16} />
                            Teams
                            {activeTab === 'teams' && teams.length > 0 && (
                                <span className="ml-1 bg-orange-700 text-xs px-2 py-0.5 rounded-full">
                                    {teams.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('seasons');
                                setSelectedSeasonId(null);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                activeTab === 'seasons'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-card text-slate-400 hover:bg-muted'
                            }`}
                        >
                            <Calendar size={16} />
                            Seasons
                        </button>
                    </div>

                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row gap-3 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder={activeTab === 'teams' ? "Search teams..." : "Search games..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                            />
                        </div>
                        
                        {activeTab === 'historical' && (
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : activeTab === 'seasons' ? (
                    // Seasons Tab
                    selectedSeasonId ? (
                        <div className="space-y-8">
                            <button 
                                onClick={() => setSelectedSeasonId(null)}
                                className="text-sm text-slate-400 hover:text-white flex items-center gap-2"
                            >
                                <ArrowLeft size={14} /> Back to All Seasons
                            </button>
                            
                            <div className="bg-input border border-border rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-6">Standings</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-card text-xs uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Team</th>
                                                <th className="px-4 py-3 text-center">Played</th>
                                                <th className="px-4 py-3 text-center text-green-500">W</th>
                                                <th className="px-4 py-3 text-center text-red-500">L</th>
                                                <th className="px-4 py-3 text-center">PF</th>
                                                <th className="px-4 py-3 text-center">PA</th>
                                                <th className="px-4 py-3 text-center">Diff</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {standings.map((team) => (
                                                <tr key={team.teamId} className="hover:bg-card/50 transition-colors">
                                                    <td className="px-4 py-4 font-bold">{team.teamName}</td>
                                                    <td className="px-4 py-4 text-center">{team.played}</td>
                                                    <td className="px-4 py-4 text-center text-green-500 font-bold">{team.wins}</td>
                                                    <td className="px-4 py-4 text-center text-red-500 font-bold">{team.losses}</td>
                                                    <td className="px-4 py-4 text-center">{team.pointsFor}</td>
                                                    <td className="px-4 py-4 text-center">{team.pointsAgainst}</td>
                                                    <td className="px-4 py-4 text-center font-mono">
                                                        {team.pointDiff > 0 ? `+${team.pointDiff}` : team.pointDiff}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xl font-bold">Season Games</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {seasonGames.map((game) => (
                                        <GameCard key={game.id} game={game} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {seasons.map((season) => (
                                <div 
                                    key={season.id}
                                    onClick={() => setSelectedSeasonId(season.id)}
                                    className="bg-card/50 border border-border p-6 rounded-2xl cursor-pointer hover:border-orange-500/50 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                                            season.status === 'active' ? "bg-green-500/20 text-green-500" :
                                            season.status === 'completed' ? "bg-blue-500/20 text-blue-500" :
                                            "bg-yellow-500/20 text-yellow-500"
                                        )}>
                                            {season.status}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold group-hover:text-orange-500 transition-colors">{season.name}</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                                    </p>
                                    <div className="mt-6 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-orange-500">
                                        View Standings & Games
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            ))}
                            {seasons.length === 0 && (
                                <div className="col-span-full text-center py-12">
                                    <Calendar className="w-12 h-12 mx-auto text-slate-700 mb-4" />
                                    <p className="text-slate-500 italic">No seasons found for this community.</p>
                                </div>
                            )}
                        </div>
                    )
                ) : activeTab === 'teams' ? (
                    // Teams Tab
                    filteredTeams.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-slate-500 mb-2">
                                <Users className="w-12 h-12 mx-auto" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-300 mb-1">No teams found</h3>
                            <p className="text-slate-500">
                                {searchQuery ? 'Try a different search term' : 'This community has no teams yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTeams.map((team) => (
                                <Link key={team.id} href={`/teams/${team.id}`}>
                                    <div className="bg-card/50 border border-border rounded-lg p-4 hover:bg-card transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            {team.color && (
                                                <div
                                                    className="w-4 h-12 rounded-full"
                                                    style={{ backgroundColor: team.color }}
                                                />
                                            )}
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-100">
                                                    {team.shortCode || team.name}
                                                </div>
                                                {team.shortCode && team.shortCode !== team.name && (
                                                    <div className="text-sm text-slate-500">{team.name}</div>
                                                )}
                                                {team._count && (
                                                    <div className="text-xs text-slate-600 mt-1">
                                                        {team._count.memberships} players
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                ) : (
                    // Games Tabs (Live/Historical)
                    filteredGames.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-slate-500 mb-2">
                                {activeTab === 'live' ? '🏀' : '📅'}
                            </div>
                            <h3 className="text-lg font-medium text-slate-300 mb-1">
                                No {activeTab === 'live' ? 'live' : 'historical'} games found
                            </h3>
                            <p className="text-slate-500">
                                {activeTab === 'live' 
                                    ? 'No live games at the moment. Check back later!'
                                    : 'Try adjusting your search or date filters'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredGames.map((game) => (
                                <GameCard key={game.id} game={game} />
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
