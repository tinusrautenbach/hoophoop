'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHasuraGame } from '@/hooks/use-hasura-game';
import { motion } from 'framer-motion';
import { Trophy, Table, RefreshCw, Wifi, WifiOff, Eye, Globe, Users2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GameLog, type GameEvent } from '@/components/scorer/game-log';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    points: number;
    fouls: number;
    isActive: boolean;
};

type GameEventRaw = {
    id: string;
    type: string;
    team: 'home' | 'guest';
    createdAt?: string;
    timestamp?: string;
};

type Game = {
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
    visibility: 'private' | 'public_general' | 'public_community';
    status: 'scheduled' | 'live' | 'final';
    isTimerRunning: boolean;
    rosters: RosterEntry[];
};

export default function SpectatorPage() {
    const { id } = useParams();
    const router = useRouter();
    
    const {
        gameState: hasuraState,
        gameEvents: hasuraEvents,
        currentClock,
        isTimerRunning,
        isConnected,
    } = useHasuraGame(id as string);

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<GameEvent[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setLoading(false);
                setLastSyncTime(new Date());
            });
    }, [id]);

    useEffect(() => {
        if (!hasuraState) return;
        
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs Hasura subscription data to local state
        setGame(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                homeScore: hasuraState.homeScore ?? prev.homeScore,
                guestScore: hasuraState.guestScore ?? prev.guestScore,
                homeFouls: hasuraState.homeFouls ?? prev.homeFouls,
                guestFouls: hasuraState.guestFouls ?? prev.guestFouls,
                homeTimeouts: hasuraState.homeTimeouts ?? prev.homeTimeouts,
                guestTimeouts: hasuraState.guestTimeouts ?? prev.guestTimeouts,
                currentPeriod: hasuraState.currentPeriod ?? prev.currentPeriod,
                possession: hasuraState.possession ?? prev.possession,
                status: hasuraState.status ?? prev.status,
                clockSeconds: currentClock,
                isTimerRunning,
            };
        });
        setLastSyncTime(new Date());
    }, [hasuraState, currentClock, isTimerRunning]);

    // Sync timer clock into local game state even when hasuraState (gameStates subscription) is unavailable.
    // The timer runs via timer_sync which has its own subscription, independent of game_states.
    useEffect(() => {
        if (hasuraState) return; // already handled above
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs timer subscription to local state
        setGame(prev => {
            if (!prev) return prev;
            if (prev.clockSeconds === currentClock && prev.isTimerRunning === isTimerRunning) return prev;
            return { ...prev, clockSeconds: currentClock, isTimerRunning };
        });
    }, [hasuraState, currentClock, isTimerRunning]);

    useEffect(() => {
        if (!hasuraEvents) return;
        
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs Hasura subscription events to local state
        setEvents(hasuraEvents.map((e) => ({
            id: e._id,
            type: e.type as GameEvent['type'],
            period: e.period,
            clockAt: e.clockAt,
            team: e.team || 'home',
            player: e.player,
            value: e.value,
            metadata: e.metadata as { points?: number; shotType?: '2pt' | '3pt' | 'ft' },
            description: e.description,
            timestamp: new Date(e.createdAt),
        })) as GameEvent[]);
    }, [hasuraEvents]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleManualSync = () => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setLastSyncTime(new Date());
                if (data.events) {
                    setEvents(data.events.map((e: GameEventRaw) => ({
                        ...e,
                        timestamp: new Date(e.createdAt || e.timestamp || Date.now())
                    })) as GameEvent[]);
                }
            });
    };

    if (loading || !game) return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-4 sm:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-500 italic text-sm sm:text-base">Connecting to the Stadium...</div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col font-sans select-none overflow-hidden text-white">
            {/* Main Scoreboard - High Visibility */}
            <div className="flex-1 flex flex-col justify-center p-2 sm:p-4 md:p-6 lg:p-8 min-h-0">

                {/* Clock & Period - Responsive sizing */}
                <div className="text-center space-y-0.5 sm:space-y-1 md:space-y-2 shrink-0 mb-2 sm:mb-4 md:mb-6">
                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                        <div className="text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] font-black text-[8px] sm:text-[10px] md:text-xs">
                            Period {game.currentPeriod} / {game.totalPeriods}
                        </div>
                        {/* Visibility Badge */}
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold uppercase ${
                            game.visibility === 'private' ? 'bg-card text-slate-500' :
                            game.visibility === 'public_general' ? 'bg-green-500/20 text-green-500' :
                            'bg-blue-500/20 text-blue-500'
                        }`}>
                            {game.visibility === 'private' ? <Eye size={10} className="sm:w-3 sm:h-3" /> :
                             game.visibility === 'public_general' ? <Globe size={10} className="sm:w-3 sm:h-3" /> :
                             <Users2 size={10} className="sm:w-3 sm:h-3" />}
                            {game.visibility === 'private' ? 'Private' :
                             game.visibility === 'public_general' ? 'Public' : 'Community'}
                        </div>
                        {/* Connection Status & Sync Button */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isConnected ? (
                                <Wifi size={12} className="sm:w-3.5 sm:h-3.5 text-green-500" />
                            ) : (
                                <WifiOff size={12} className="sm:w-3.5 sm:h-3.5 text-red-500" />
                            )}
                            <button
                                onClick={handleManualSync}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-[8px] sm:text-[10px] font-bold uppercase transition-all",
                                    isConnected
                                        ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                                        : "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 animate-pulse"
                                )}
                                title="Sync Game Data"
                            >
                                <RefreshCw size={10} className="sm:w-3 sm:h-3" />
                                {isConnected ? 'Synced' : 'Sync'}
                            </button>
                        </div>
                    </div>
                    <div className={cn(
                        "font-mono font-black tracking-tighter transition-all duration-300",
                        "text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl",
                        isTimerRunning ? "text-orange-500" : "text-slate-700"
                    )}>
                        {formatTime(game.clockSeconds)}
                    </div>
                    {!isConnected && (
                        <div className="text-red-500 text-[8px] sm:text-[10px] uppercase font-bold animate-pulse">Disconnected - Reconnecting...</div>
                    )}
                    {lastSyncTime && (
                        <div className="text-slate-600 text-[8px] sm:text-[10px] uppercase font-medium">
                            Last sync: {lastSyncTime.toLocaleTimeString()}
                        </div>
                    )}
                </div>

                {/* Score Spread - Responsive grid */}
                <div className="w-full max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] gap-1 sm:gap-2 md:gap-4 items-center shrink-0">
                    {/* Home Team */}
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex flex-col items-center gap-1 sm:gap-2 md:gap-4"
                    >
                        <div className="text-center w-full">
                            <h2 className={cn(
                                "font-black uppercase italic tracking-tighter text-orange-500 leading-none truncate",
                                "text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl",
                                "max-w-[100px] xs:max-w-[120px] sm:max-w-[150px] md:max-w-[200px] lg:max-w-[250px] xl:max-w-none"
                            )}>
                                {game.homeTeamName}
                            </h2>
                            <div className="flex justify-center gap-0.5 sm:gap-1 mt-1 sm:mt-2">
                                {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                    <div key={i} className={cn(
                                        "rounded-full",
                                        i < game.homeTimeouts ? "bg-orange-500" : "bg-card",
                                        "w-1.5 h-0.5 sm:w-2 sm:h-1 md:w-3 md:h-1 lg:w-4"
                                    )} 
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={cn(
                            "font-black leading-none tabular-nums",
                            "text-5xl xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl"
                        )}>
                            {game.homeScore}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            <div className={cn(
                                "font-bold text-slate-500 uppercase tracking-widest hidden sm:block",
                                "text-[6px] sm:text-[8px] md:text-[10px]"
                            )}>Fouls</div>
                            <div className={cn(
                                "font-black rounded-lg border transition-all",
                                "px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1",
                                "text-base sm:text-lg md:text-xl lg:text-2xl",
                                game.homeFouls >= 5 ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" : "bg-input border-border text-slate-400"
                            )}>
                                {game.homeFouls}
                            </div>
                        </div>
                    </motion.div>

                    {/* Possession Arrow & Dash */}
                    <div className="flex flex-col items-center justify-center px-1 sm:px-2 md:px-4">
                        <div className={cn(
                            "rounded-full border-2 flex items-center justify-center transition-all duration-500 bg-background shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                            "w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 lg:w-16 lg:h-16",
                            "mb-2 sm:mb-4 md:mb-6 lg:mb-8",
                            game.possession === 'home' ? "rotate-180 border-orange-500/50" : game.possession === 'guest' ? "rotate-0 border-white/50" : "opacity-0"
                        )}>
                            <Trophy className={cn(
                                game.possession === 'home' ? "text-orange-500" : "text-white",
                                "w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6"
                            )} />
                        </div>
                        <span className={cn(
                            "font-black text-slate-500 leading-none",
                            "text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl"
                        )}>-</span>
                    </div>

                    {/* Guest Team */}
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex flex-col items-center gap-1 sm:gap-2 md:gap-4"
                    >
                        <div className="text-center w-full">
                            <h2 className={cn(
                                "font-black uppercase italic tracking-tighter text-white leading-none truncate",
                                "text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl",
                                "max-w-[100px] xs:max-w-[120px] sm:max-w-[150px] md:max-w-[200px] lg:max-w-[250px] xl:max-w-none"
                            )}>
                                {game.guestTeamName}
                            </h2>
                            <div className="flex justify-center gap-0.5 sm:gap-1 mt-1 sm:mt-2">
                                {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                    <div key={i} className={cn(
                                        "rounded-full",
                                        i < game.guestTimeouts ? "bg-white" : "bg-card",
                                        "w-1.5 h-0.5 sm:w-2 sm:h-1 md:w-3 md:h-1 lg:w-4"
                                    )} 
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={cn(
                            "font-black leading-none tabular-nums",
                            "text-5xl xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl"
                        )}>
                            {game.guestScore}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            <div className={cn(
                                "font-black rounded-lg border transition-all",
                                "px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1",
                                "text-base sm:text-lg md:text-xl lg:text-2xl",
                                game.guestFouls >= 5 ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" : "bg-input border-border text-slate-400"
                            )}>
                                {game.guestFouls}
                            </div>
                            <div className={cn(
                                "font-bold text-slate-500 uppercase tracking-widest hidden sm:block",
                                "text-[6px] sm:text-[8px] md:text-[10px]"
                            )}>Fouls</div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="bg-background/80 border-t border-white/5 p-2 sm:p-4 md:p-6 backdrop-blur-xl relative z-10 shrink-0">
                <div className={cn(
                    "max-w-7xl mx-auto grid gap-2 sm:gap-4 md:gap-6 lg:gap-8",
                    "h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px] xl:h-[400px]",
                    "grid-cols-1 md:grid-cols-2"
                )}>
                    {/* Game Log - Now Scrolling */}
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex items-center justify-between mb-1 sm:mb-2 md:mb-4 px-1 sm:px-2">
                            <h3 
                                onClick={() => router.push(`/game/${id}/log`)}
                                className={cn(
                                    "font-black uppercase text-slate-500 hover:text-orange-500 cursor-pointer transition-all active:scale-95",
                                    "text-[6px] sm:text-[8px] md:text-[10px]",
                                    "tracking-[0.15em] sm:tracking-[0.2em]"
                                )}
                            >
                                Live Play-by-Play
                            </h3>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={() => router.push(`/game/${id}/box-score`)}
                                    className="flex items-center gap-1 text-[8px] sm:text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase tracking-wider transition-colors"
                                >
                                    <Table size={12} className="sm:w-3.5 sm:h-3.5" />
                                    Box Score
                                </button>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                    <span className={cn(
                                        "font-bold text-slate-600 uppercase tracking-widest",
                                        "text-[6px] sm:text-[8px]"
                                    )}>Real-time</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <GameLog 
                                events={events} 
                                limit={10}
                                hideHeader={true}
                            />
                        </div>
                    </div>

                    {/* Active Lineup */}
                    <div className="hidden md:flex flex-col h-full overflow-hidden">
                        <h3 className={cn(
                            "font-black uppercase text-slate-500 mb-2 sm:mb-4 px-1 sm:px-2",
                            "text-[6px] sm:text-[8px] md:text-[10px]",
                            "tracking-[0.15em] sm:tracking-[0.2em]"
                        )}>On the Floor</h3>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                                {game.rosters?.filter(r => r.isActive).sort((a) => a.team === 'home' ? -1 : 1).map(player => (
                                    <div key={player.id} className={cn(
                                        "bg-input/40 border rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 transition-all",
                                        "p-2 sm:p-3",
                                        player.team === 'home' ? "border-orange-500/20" : "border-white/5"
                                    )}>
                                        <div className={cn(
                                            "rounded-lg sm:rounded-xl flex items-center justify-center font-black",
                                            "w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10",
                                            "text-sm sm:text-base md:text-lg",
                                            player.team === 'home' ? "bg-orange-500/20 text-orange-500" : "bg-card text-slate-400"
                                        )}>
                                            {player.number}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className={cn(
                                                "font-black truncate text-white leading-tight uppercase font-sans",
                                                "text-[8px] sm:text-[9px] md:text-[10px]"
                                            )}>{player.name}</div>
                                            <div className={cn(
                                                "font-bold text-slate-600 uppercase tracking-tighter",
                                                "text-[6px] sm:text-[7px] md:text-[8px]"
                                            )}>
                                                {player.points} PTS • {player.fouls} F
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
