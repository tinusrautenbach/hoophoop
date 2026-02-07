'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Users, ArrowLeft, RotateCcw, ShieldAlert, MoreHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SimpleScorer } from '@/components/scorer/simple-scorer';
import { AdvancedScorer } from '@/components/scorer/advanced-scorer';
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
    currentPeriod: number;
    totalPeriods: number;
    periodSeconds: number;
    clockSeconds: number;
    possession: 'home' | 'guest' | null;
    mode: 'simple' | 'advanced';
    rosters: RosterEntry[];
};

export default function ScorerPage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket, isConnected } = useSocket(id as string);

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [scoringFor, setScoringFor] = useState<{ points: number, side?: 'home' | 'guest' } | null>(null);
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
        socket.on('game-updated', (updatedGame: Game) => {
            setGame(updatedGame);
        });
    }, [socket]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && game && game.clockSeconds > 0) {
            interval = setInterval(() => {
                setGame(prev => prev ? { ...prev, clockSeconds: prev.clockSeconds - 1 } : null);
            }, 1000);
        } else if (game?.clockSeconds === 0) {
            setIsTimerRunning(false);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, game?.clockSeconds]);

    // Periodic sync with server
    useEffect(() => {
        if (!isTimerRunning || !game) return;
        const interval = setInterval(() => {
            socket?.emit('update-game', { gameId: id, updates: { clockSeconds: game.clockSeconds } });
        }, 5000);
        return () => clearInterval(interval);
    }, [isTimerRunning, game?.clockSeconds, socket, id]);

    const toggleTimer = () => {
        if (!isTimerRunning && game?.clockSeconds === 0) return;
        const newRunning = !isTimerRunning;
        setIsTimerRunning(newRunning);
        if (!newRunning && game) {
            // Sync with server when paused
            updateGame({ clockSeconds: game.clockSeconds });
        }
    };

    const handleScore = (points: number, side?: 'home' | 'guest') => {
        setScoringFor({ points, side });
    };

    const addEvent = (event: Omit<GameEvent, 'id' | 'timestamp'>) => {
        const newEvent: GameEvent = {
            ...event,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
        };
        setEvents(prev => [newEvent, ...prev]);
    };

    const handlePlayerScore = (rosterEntryId: string) => {
        if (!scoringFor || !game) return;

        const player = game.rosters.find(r => r.id === rosterEntryId);
        if (!player) return;

        const updatedRosters = game.rosters.map(r =>
            r.id === rosterEntryId ? { ...r, points: r.points + scoringFor.points } : r
        );

        const scoreUpdate = player.team === 'home'
            ? { homeScore: game.homeScore + scoringFor.points }
            : { guestScore: game.guestScore + scoringFor.points };

        updateGame({
            ...scoreUpdate,
            rosters: updatedRosters
        });

        addEvent({
            type: 'score',
            team: player.team,
            player: player.name,
            value: scoringFor.points,
        });

        setScoringFor(null);
    };

    const handleFoul = (side: 'home' | 'guest') => {
        if (!game) return;
        const updates = side === 'home'
            ? { homeFouls: game.homeFouls + 1 }
            : { guestFouls: game.guestFouls + 1 };
        updateGame(updates);
        addEvent({
            type: 'foul',
            team: side,
        });
    };

    const nextPeriod = () => {
        if (!game) return;
        if (game.currentPeriod >= game.totalPeriods) return; // Game over logic handled elsewhere or just stop

        updateGame({
            currentPeriod: game.currentPeriod + 1,
            homeFouls: 0,
            guestFouls: 0,
            clockSeconds: game.periodSeconds,
        });
        setIsTimerRunning(false);
    };

    const togglePossession = () => {
        if (!game) return;
        updateGame({
            possession: game.possession === 'home' ? 'guest' : 'home'
        });
    };

    const updateGame = (updates: Partial<Game>) => {
        if (!socket || !game) return;
        const newState = { ...game, ...updates };
        setGame(newState);
        socket.emit('update-game', { gameId: id, updates });
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading || !game) return <div className="p-8 text-center text-slate-500 italic">Entering Arena...</div>;

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col font-sans select-none touch-none overflow-hidden">
            {/* Top Header - THE DISPLAY */}
            <div className="bg-black/40 border-b border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-white">
                    <ArrowLeft size={20} />
                </button>

                <div className="flex flex-col items-center">
                    <button
                        onClick={nextPeriod}
                        className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 flex items-center gap-1 hover:text-white transition-colors"
                    >
                        <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
                        Period {game.currentPeriod} / {game.totalPeriods}
                    </button>
                    <div className="font-mono text-4xl text-orange-500 tracking-tighter leading-none">
                        {formatTime(game.clockSeconds)}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={togglePossession}
                        className="p-2 text-slate-500 hover:text-white"
                        title="Toggle Possession"
                    >
                        <RotateCcw size={20} className={cn(game.possession === 'home' && "text-orange-500 rotate-180", game.possession === 'guest' && "text-slate-300")} />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-white">
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>


            {/* Main Scoring Area */}
            {game.mode === 'advanced' ? (
                <AdvancedScorer
                    game={game}
                    updateGame={updateGame}
                    handleScore={handleScore}
                />
            ) : (
                <SimpleScorer
                    game={game}
                    handleScore={handleScore}
                    handleFoul={handleFoul}
                />
            )}

            {/* Game Log - Compact Feed at Bottom */}
            <div className="px-4 py-2 border-t border-white/5 bg-slate-900/40">
                <GameLog events={events} />
            </div>

            {/* Bottom Controls */}
            <div className="h-20 bg-slate-900 border-t border-slate-800 grid grid-cols-3 gap-1 p-1">
                <button className="bg-slate-800/50 rounded-xl font-bold text-xs uppercase text-slate-400">Timeouts</button>
                <button
                    onClick={toggleTimer}
                    className={cn(
                        "rounded-xl font-black text-xl flex items-center justify-center gap-2 transition-all",
                        isTimerRunning ? "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]" : "bg-orange-600 shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                    )}
                >
                    <Clock fill="currentColor" size={24} className={cn(isTimerRunning && "animate-pulse")} />
                    {isTimerRunning ? 'STOP' : 'START'}
                </button>
                <button className="bg-slate-800/50 rounded-xl font-bold text-xs uppercase text-slate-400">Subs</button>
            </div>

            {/* Roster Selection Overlay (for Simple Mode Home Team or Advanced Mode Both) */}
            <AnimatePresence>
                {scoringFor && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl p-8 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-black flex items-center gap-3">
                                <span className="text-orange-500">+{scoringFor.points}</span>
                                WHO SCORED?
                            </h3>
                            <button onClick={() => setScoringFor(null)} className="p-4 text-slate-400 hover:text-white">Cancel</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pb-12">
                            {/* Home Side */}
                            {(!scoringFor.side || scoringFor.side === 'home') && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-orange-500 uppercase tracking-widest px-2">
                                        {game.homeTeamName}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {game.rosters
                                            .filter(r => r.team === 'home')
                                            .map(entry => (
                                                <button
                                                    key={entry.id}
                                                    onClick={() => handlePlayerScore(entry.id)}
                                                    className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center hover:border-orange-500 transition-colors group"
                                                >
                                                    <div className="text-2xl font-black text-slate-500 group-hover:text-orange-500 mb-1">{entry.number}</div>
                                                    <div className="text-xs font-bold truncate w-full text-center">{entry.name}</div>
                                                </button>
                                            ))}
                                        <button
                                            onClick={() => {
                                                updateGame({ homeScore: game.homeScore + scoringFor.points });
                                                addEvent({ type: 'score', team: 'home', value: scoringFor.points });
                                                setScoringFor(null);
                                            }}
                                            className="bg-slate-800 border-dashed border-2 border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center italic text-slate-400 text-xs"
                                        >
                                            Team Score
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Guest Side */}
                            {(!scoringFor.side || scoringFor.side === 'guest') && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2 text-right">
                                        {game.guestTeamName}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {game.rosters
                                            .filter(r => r.team === 'guest')
                                            .map(entry => (
                                                <button
                                                    key={entry.id}
                                                    onClick={() => handlePlayerScore(entry.id)}
                                                    className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center hover:border-slate-400 transition-colors group"
                                                >
                                                    <div className="text-2xl font-black text-slate-500 group-hover:text-white mb-1">{entry.number}</div>
                                                    <div className="text-xs font-bold truncate w-full text-center text-slate-400">{entry.name}</div>
                                                </button>
                                            ))}
                                        <button
                                            onClick={() => {
                                                updateGame({ guestScore: game.guestScore + scoringFor.points });
                                                addEvent({ type: 'score', team: 'guest', value: scoringFor.points });
                                                setScoringFor(null);
                                            }}
                                            className="bg-slate-800 border-dashed border-2 border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center italic text-slate-400 text-xs"
                                        >
                                            Team Score
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
