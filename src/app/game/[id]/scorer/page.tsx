'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Users, ArrowLeft, RotateCcw, ShieldAlert, MoreHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    points: number;
    fouls: number;
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
    clockSeconds: number;
    rosters: RosterEntry[];
};

export default function ScorerPage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket, isConnected } = useSocket(id as string);

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [scoringFor, setScoringFor] = useState<{ side: 'home' | 'guest', points: number } | null>(null);

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

    const handleScore = (side: 'home' | 'guest', points: number) => {
        if (side === 'home') {
            setScoringFor({ side, points });
        } else {
            // Direct update for guest in simple mode
            updateGame({ guestScore: (game?.guestScore || 0) + points });
        }
    };

    const handlePlayerScore = (rosterEntryId: string) => {
        if (!scoringFor || !game) return;

        // Logic: In a real app, we'd send an event to the server
        // For now, let's pretend we're updating local state and emitting
        const updatedRosters = game.rosters.map(r =>
            r.id === rosterEntryId ? { ...r, points: r.points + scoringFor.points } : r
        );

        updateGame({
            homeScore: game.homeScore + scoringFor.points,
            rosters: updatedRosters
        });

        setScoringFor(null);
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
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
                        Period {game.currentPeriod}
                    </div>
                    <div className="font-mono text-4xl text-orange-500 tracking-tighter leading-none">
                        {formatTime(game.clockSeconds)}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-500 hover:text-white">
                        <RotateCcw size={20} />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-white">
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>

            {/* Main Scoring Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Home Team */}
                <div className="flex-1 flex flex-col border-r border-slate-900">
                    <div className="p-4 text-center">
                        <h2 className="text-xl font-black italic tracking-tighter uppercase text-orange-500 truncate">
                            {game.homeTeamName}
                        </h2>
                        <div className="text-6xl font-black mt-1 font-mono">{game.homeScore}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Fouls: {game.homeFouls}</div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-2 p-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleScore('home', 2)}
                                className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-8 gap-1 border border-slate-700/50"
                            >
                                <span className="text-3xl font-black">+2</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Points</span>
                            </button>
                            <button
                                onClick={() => handleScore('home', 3)}
                                className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-8 gap-1 border border-slate-700/50"
                            >
                                <span className="text-3xl font-black text-orange-500">+3</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Points</span>
                            </button>
                        </div>
                        <button
                            onClick={() => handleScore('home', 1)}
                            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center"
                        >
                            <span className="text-slate-500 text-xs">FREE THROW</span>
                            <span className="text-xl">+1</span>
                        </button>
                        <button className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center text-red-500">
                            <span className="text-xs uppercase tracking-widest">Team Foul</span>
                            <ShieldAlert size={18} />
                        </button>
                    </div>
                </div>

                {/* Guest Team */}
                <div className="flex-1 flex flex-col bg-slate-900/20">
                    <div className="p-4 text-center">
                        <h2 className="text-xl font-black italic tracking-tighter uppercase text-slate-400 truncate">
                            {game.guestTeamName}
                        </h2>
                        <div className="text-6xl font-black mt-1 font-mono text-slate-300">{game.guestScore}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Fouls: {game.guestFouls}</div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-2 p-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleScore('guest', 2)}
                                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-8 gap-1"
                            >
                                <span className="text-3xl font-black">+2</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Direct</span>
                            </button>
                            <button
                                onClick={() => handleScore('guest', 3)}
                                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-8 gap-1"
                            >
                                <span className="text-3xl font-black">+3</span>
                            </button>
                        </div>
                        <button
                            onClick={() => handleScore('guest', 1)}
                            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center"
                        >
                            <span className="text-slate-500 text-xs">FREE THROW</span>
                            <span className="text-xl">+1</span>
                        </button>
                        <button className="bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center">
                            <span className="text-xs uppercase tracking-widest text-slate-500">Team Foul</span>
                            <ShieldAlert size={18} className="text-slate-700" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="h-20 bg-slate-900 border-t border-slate-800 grid grid-cols-3 gap-1 p-1">
                <button className="bg-slate-800/50 rounded-xl font-bold text-xs uppercase text-slate-400">Timeouts</button>
                <button className="bg-orange-600 rounded-xl font-black text-xl flex items-center justify-center gap-2">
                    <Clock fill="currentColor" size={24} />
                    START
                </button>
                <button className="bg-slate-800/50 rounded-xl font-bold text-xs uppercase text-slate-400">Subs</button>
            </div>

            {/* Roster Selection Overlay (for Simple Mode Home Team) */}
            <AnimatePresence>
                {scoringFor?.side === 'home' && (
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

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto pb-12">
                            {game.rosters.map(entry => (
                                <button
                                    key={entry.id}
                                    onClick={() => handlePlayerScore(entry.id)}
                                    className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col items-center hover:border-orange-500 transition-colors group"
                                >
                                    <div className="text-3xl font-black text-slate-500 group-hover:text-orange-500 mb-1">{entry.number}</div>
                                    <div className="text-sm font-bold truncate w-full text-center">{entry.name}</div>
                                </button>
                            ))}
                            {/* Ad-hoc Option */}
                            <button
                                onClick={() => {
                                    updateGame({ homeScore: game.homeScore + scoringFor.points });
                                    setScoringFor(null);
                                }}
                                className="bg-slate-800 border-dashed border-2 border-slate-700 p-6 rounded-3xl flex flex-col items-center justify-center italic text-slate-400"
                            >
                                Unassigned
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
