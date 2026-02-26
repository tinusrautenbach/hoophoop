'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameCard } from './components/game-card';
import { Search, Calendar } from 'lucide-react';
import { getHasuraWsClient } from '@/lib/hasura/client';

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
    community?: {
        id: string;
        name: string;
        slug: string;
    } | null;
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

interface GroupedGames {
    community: {
        id?: string;
        name: string;
        slug: string;
    };
    games: Game[];
}

type TabType = 'live' | 'historical';

export default function LivePage() {
    const [activeTab, setActiveTab] = useState<TabType>('live');
    const [games, setGames] = useState<Game[]>([]);
    const [groupedGames, setGroupedGames] = useState<GroupedGames[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Fetch games from API
    const fetchGames = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', activeTab === 'live' ? 'live' : 'final');
            if (searchQuery) params.set('search', searchQuery);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const response = await fetch(`/api/public/games?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch games');
            
            const data = await response.json();
            setGames(data.games);
            setGroupedGames(data.groupedByCommunity);
        } catch (error) {
            console.error('Error fetching games:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, searchQuery, dateFrom, dateTo]);

    // Initial fetch
    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    // Subscribe to live game state updates via Hasura WebSocket (live tab only)
    useEffect(() => {
        if (activeTab !== 'live') {
            // Clean up subscription when leaving live tab
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            return;
        }

        const client = getHasuraWsClient();
        const unsubscribe = client.subscribe<{
            gameStates: Array<{
                gameId: string;
                homeScore: number;
                guestScore: number;
                homeFouls: number;
                guestFouls: number;
                homeTimeouts: number;
                guestTimeouts: number;
                clockSeconds: number;
                currentPeriod: number;
                possession: string;
                status: string;
                isTimerRunning: boolean;
            }>;
        }>(
            {
                query: `
                    subscription LiveGameStates {
                        gameStates(where: { status: { _eq: "live" } }) {
                            gameId
                            homeScore
                            guestScore
                            homeFouls
                            guestFouls
                            homeTimeouts
                            guestTimeouts
                            clockSeconds
                            currentPeriod
                            possession
                            status
                            isTimerRunning
                        }
                    }
                `,
            },
            {
                next: (result) => {
                    const states = result.data?.gameStates;
                    if (!states) return;
                    // Patch matching games with fresh real-time state
                    setGames(prev => prev.map(game => {
                        const liveState = states.find(s => s.gameId === game.id);
                        if (!liveState) return game;
                        return {
                            ...game,
                            homeScore: liveState.homeScore,
                            guestScore: liveState.guestScore,
                            homeFouls: liveState.homeFouls,
                            guestFouls: liveState.guestFouls,
                            homeTimeouts: liveState.homeTimeouts,
                            guestTimeouts: liveState.guestTimeouts,
                            clockSeconds: liveState.clockSeconds,
                            currentPeriod: liveState.currentPeriod,
                            possession: liveState.possession as 'home' | 'guest' | null,
                            status: liveState.status as Game['status'],
                            isTimerRunning: liveState.isTimerRunning,
                        };
                    }));
                },
                error: (err) => {
                    console.error('[Hasura] Live games subscription error:', err);
                },
                complete: () => {
                    console.log('[Hasura] Live games subscription completed');
                },
            }
        );

        unsubscribeRef.current = unsubscribe;
        return () => {
            unsubscribe();
            unsubscribeRef.current = null;
        };
    }, [activeTab]);
    // Filter games by search
    const filteredGames = games.filter(game => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            game.homeTeamName.toLowerCase().includes(query) ||
            game.guestTeamName.toLowerCase().includes(query) ||
            game.community?.name?.toLowerCase().includes(query) ||
            game.homeTeam?.name?.toLowerCase().includes(query) ||
            game.guestTeam?.name?.toLowerCase().includes(query)
        );
    });

    // Filter grouped games
    const filteredGroupedGames = groupedGames.map(group => ({
        ...group,
        games: group.games.filter(game => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                game.homeTeamName.toLowerCase().includes(query) ||
                game.guestTeamName.toLowerCase().includes(query) ||
                game.homeTeam?.name?.toLowerCase().includes(query) ||
                game.guestTeam?.name?.toLowerCase().includes(query)
            );
        })
    })).filter(group => group.games.length > 0);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-input border-b border-border sticky top-16 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">Live Scores</h1>
                            <p className="text-slate-400 text-sm">Real-time basketball scores from communities worldwide</p>
                        </div>
                        

                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                activeTab === 'live'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-card text-slate-400 hover:bg-muted'
                            }`}
                        >
                            Live Games
                            {activeTab === 'live' && games.length > 0 && (
                                <span className="ml-2 bg-orange-700 text-xs px-2 py-0.5 rounded-full">
                                    {games.length}
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
                            {activeTab === 'historical' && games.length > 0 && (
                                <span className="ml-2 bg-orange-700 text-xs px-2 py-0.5 rounded-full">
                                    {games.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row gap-3 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search teams or communities..."
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
                ) : filteredGames.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-slate-500 mb-2">
                            {activeTab === 'live' ? '🏀' : '📅'}
                        </div>
                        <h3 className="text-lg font-medium text-slate-300 mb-1">
                            No {activeTab === 'live' ? 'live' : 'historical'} games found
                        </h3>
                        <p className="text-slate-500">
                            {activeTab === 'live' 
                                ? 'Check back later for live games or browse historical results'
                                : 'Try adjusting your search or date filters'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {searchQuery ? (
                            // Show flat list when searching
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredGames.map((game) => (
                                    <GameCard key={game.id} game={game} />
                                ))}
                            </div>
                        ) : (
                            // Show grouped by community
                            filteredGroupedGames.map((group) => (
                                <div key={group.community.id ?? `name:${group.community.name}`}>
                                    <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                        {group.community.name}
                                        <span className="text-sm text-slate-500 font-normal">
                                            ({group.games.length} games)
                                        </span>
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.games.map((game) => (
                                            <GameCard key={game.id} game={game} />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
