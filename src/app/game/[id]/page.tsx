'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Users, ArrowLeft, ShieldAlert, Target } from 'lucide-react';
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
    status: 'scheduled' | 'live' | 'final';
    rosters: RosterEntry[];
};

export default function SpectatorPage() {
    const { id } = useParams();
    const { socket, isConnected } = useSocket(id as string);

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [events, setEvents] = useState<GameEvent[]>([]);

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!socket) return;
        socket.on('game-updated', (updates: Partial<Game> & { isTimerRunning?: boolean }) => {
            setGame(prev => prev ? { ...prev, ...updates } : null);
            if (updates.isTimerRunning !== undefined) {
                setIsTimerRunning(updates.isTimerRunning);
            }
        });

        socket.on('event-added', (event: GameEvent) => {
            const newEvent = {
                ...event,
                timestamp: new Date(event.timestamp)
            };
            setEvents(prev => [newEvent, ...prev]);
        });
    }, [socket]);

    // Local ticking for spectators to keep it smooth
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && game && game.clockSeconds > 0) {
            interval = setInterval(() => {
                setGame(prev => prev ? { ...prev, clockSeconds: Math.max(0, prev.clockSeconds - 1) } : null);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading || !game) return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-500 italic">Connecting to the Stadium...</div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans select-none overflow-y-auto text-white">
            {/* Main Scoreboard - High Visibility */}
            <div className="flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 gap-4 sm:gap-12 min-h-0 pt-10 sm:pt-6">

                {/* Clock & Period */}
                <div className="text-center space-y-1 sm:space-y-2 shrink-0">
                    <div className="text-slate-500 uppercase tracking-[0.3em] font-black text-[10px] sm:text-xs">
                        Period {game.currentPeriod} / {game.totalPeriods}
                    </div>
                    <div className={cn(
                        "font-mono text-5xl sm:text-9xl font-black tracking-tighter transition-all duration-300",
                        isTimerRunning ? "text-orange-500" : "text-slate-700"
                    )}>
                        {formatTime(game.clockSeconds)}
                    </div>
                    {!isConnected && (
                        <div className="text-red-500 text-[10px] uppercase font-bold animate-pulse">Disconnected - Reconnecting...</div>
                    )}
                </div>

                {/* Score Spread */}
                <div className="w-full max-w-4xl grid grid-cols-2 gap-4 relative shrink-0">
                    {/* Home */}
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex flex-col items-end gap-2 sm:gap-4"
                    >
                        <div className="text-right">
                            <h2 className="text-xl sm:text-4xl font-black uppercase italic tracking-tighter text-orange-500 leading-none truncate max-w-[150px] sm:max-w-none">
                                {game.homeTeamName}
                            </h2>
                            <div className="flex justify-end gap-1 mt-2">
                                {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                    <div key={i} className={cn("w-3 h-1 sm:w-4 rounded-full", i < game.homeTimeouts ? "bg-orange-500" : "bg-slate-800")} />
                                ))}
                            </div>
                        </div>
                        <div className="text-7xl sm:text-9xl font-black leading-none tabular-nums">
                            {game.homeScore}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fouls</div>
                            <div className={cn(
                                "text-lg sm:text-xl font-black px-2 sm:px-3 py-1 rounded-lg border",
                                game.homeFouls >= 5 ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" : "bg-slate-900 border-slate-800 text-slate-400"
                            )}>
                                {game.homeFouls}
                            </div>
                        </div>
                    </motion.div>

                    {/* Possession Arrow & Dash */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                        <div className={cn(
                            "w-8 h-8 sm:w-16 sm:h-16 rounded-full border-2 border-slate-800 flex items-center justify-center transition-all duration-500 bg-slate-950 shadow-[0_0_20px_rgba(0,0,0,0.5)] mb-8 sm:mb-12",
                            game.possession === 'home' ? "rotate-180 border-orange-500/50" : game.possession === 'guest' ? "rotate-0 border-white/50" : "opacity-0"
                        )}>
                            <Trophy size={16} className={cn("sm:w-6 sm:h-6", game.possession === 'home' ? "text-orange-500" : "text-white")} />
                        </div>
                        <span className="text-4xl sm:text-6xl font-black text-slate-500 leading-none">-</span>
                    </div>

                    {/* Guest */}
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex flex-col items-start gap-2 sm:gap-4"
                    >
                        <div className="text-left">
                            <h2 className="text-xl sm:text-4xl font-black uppercase italic tracking-tighter text-white leading-none truncate max-w-[150px] sm:max-w-none">
                                {game.guestTeamName}
                            </h2>
                            <div className="flex justify-start gap-1 mt-2">
                                {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                    <div key={i} className={cn("w-3 h-1 sm:w-4 rounded-full", i < game.guestTimeouts ? "bg-white" : "bg-slate-800")} />
                                ))}
                            </div>
                        </div>
                        <div className="text-7xl sm:text-9xl font-black leading-none tabular-nums">
                            {game.guestScore}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "text-lg sm:text-xl font-black px-2 sm:px-3 py-1 rounded-lg border",
                                game.guestFouls >= 5 ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" : "bg-slate-900 border-slate-800 text-slate-400"
                            )}>
                                {game.guestFouls}
                            </div>
                            <div className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fouls</div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Bottom Section - Actions & Lineup */}
            <div className="bg-slate-950/80 border-t border-white/5 p-4 sm:p-6 backdrop-blur-xl relative z-10 shrink-0">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 h-[180px] sm:h-[220px]">
                    {/* Game Log - Now Scrolling */}
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex items-center justify-between mb-2 sm:mb-4 px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Play-by-Play</h3>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Real-time</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <GameLog events={events} />
                        </div>
                    </div>

                    {/* Active Lineup */}
                    <div className="hidden md:flex flex-col h-full overflow-hidden">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-2">On the Floor</h3>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-3">
                                {game.rosters?.filter(r => r.isActive).sort((a, b) => a.team === 'home' ? -1 : 1).map(player => (
                                    <div key={player.id} className={cn(
                                        "bg-slate-900/40 border p-3 rounded-2xl flex items-center gap-3 transition-all",
                                        player.team === 'home' ? "border-orange-500/20" : "border-white/5"
                                    )}>
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                                            player.team === 'home' ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-400"
                                        )}>
                                            {player.number}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="text-[10px] font-black truncate text-white leading-tight uppercase font-sans">{player.name}</div>
                                            <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
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
