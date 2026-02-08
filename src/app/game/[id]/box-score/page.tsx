'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Target, Users, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSocket } from '@/hooks/use-socket';

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
    status: 'scheduled' | 'live' | 'final';
    rosters: RosterEntry[];
};

export default function BoxScorePage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket } = useSocket(id as string);
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'home' | 'guest'>('home');

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setLoading(false);
            });
    }, [id]);

    // Listen for real-time updates
    useEffect(() => {
        if (!socket) return;

        // Listen for full game state on connection
        const handleGameState = ({ game: gameState }: { game: Game }) => {
            console.log('Box score received game-state:', gameState);
            setGame(gameState);
        };

        socket.on('game-state', handleGameState);

        socket.on('game-updated', (updates: Partial<Game>) => {
            setGame(prev => prev ? { ...prev, ...updates } : null);
        });

        // Emit join-game AFTER setting up listeners to avoid race condition
        if (socket.connected) {
            console.log('Box score emitting join-game for:', id);
            socket.emit('join-game', id);
        }

        return () => {
            socket.off('game-state', handleGameState);
            socket.off('game-updated');
        };
    }, [socket, id]);

    if (loading || !game) return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-500 italic text-sm sm:text-base">Loading Box Score...</div>
        </div>
    );

    const homeRoster = game.rosters?.filter(r => r.team === 'home') || [];
    const guestRoster = game.rosters?.filter(r => r.team === 'guest') || [];

    const activeRoster = activeTab === 'home' ? homeRoster : guestRoster;
    const teamName = activeTab === 'home' ? game.homeTeamName : game.guestTeamName;
    const teamScore = activeTab === 'home' ? game.homeScore : game.guestScore;
    const teamFouls = activeTab === 'home' ? game.homeFouls : game.guestFouls;
    const teamColor = activeTab === 'home' ? 'orange' : 'white';

    const totalPoints = activeRoster.reduce((sum, p) => sum + p.points, 0);
    const totalFouls = activeRoster.reduce((sum, p) => sum + p.fouls, 0);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans overflow-hidden text-white">
            {/* Header */}
            <div className="bg-black/40 border-b border-slate-800 p-2 sm:p-4 flex items-center justify-between shrink-0">
                <button 
                    onClick={() => router.back()} 
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </button>
                <h1 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight">
                    Box Score
                </h1>
                <div className="w-10" />
            </div>

            {/* Team Tabs */}
            <div className="flex border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('home')}
                    className={cn(
                        "flex-1 py-3 sm:py-4 px-4 text-center transition-all",
                        activeTab === 'home' 
                            ? "bg-orange-500/10 border-b-2 border-orange-500 text-orange-500" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <div className="text-xs sm:text-sm font-bold uppercase tracking-widest truncate">
                        {game.homeTeamName}
                    </div>
                    <div className="text-xl sm:text-2xl md:text-3xl font-black mt-1">
                        {game.homeScore}
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('guest')}
                    className={cn(
                        "flex-1 py-3 sm:py-4 px-4 text-center transition-all",
                        activeTab === 'guest' 
                            ? "bg-white/10 border-b-2 border-white text-white" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <div className="text-xs sm:text-sm font-bold uppercase tracking-widest truncate">
                        {game.guestTeamName}
                    </div>
                    <div className="text-xl sm:text-2xl md:text-3xl font-black mt-1">
                        {game.guestScore}
                    </div>
                </button>
            </div>

            {/* Team Summary */}
            <div className="bg-slate-900/50 p-3 sm:p-4 md:p-6">
                <div className={cn(
                    "flex items-center justify-between mb-3 sm:mb-4",
                    "p-3 sm:p-4 rounded-xl sm:rounded-2xl",
                    activeTab === 'home' ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/5 border border-white/10"
                )}>
                    <div>
                        <h2 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight truncate max-w-[200px] sm:max-w-[300px]">
                            {teamName}
                        </h2>
                        <div className="text-xs sm:text-sm text-slate-500">
                            {activeRoster.filter(r => r.isActive).length} Active Players
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={cn(
                            "text-3xl sm:text-4xl md:text-5xl font-black",
                            activeTab === 'home' ? "text-orange-500" : "text-white"
                        )}>
                            {teamScore}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-500">
                            Team Fouls: {teamFouls}
                        </div>
                    </div>
                </div>

                {/* Stat Summary Cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Players
                        </div>
                        <div className="text-xl sm:text-2xl md:text-3xl font-black">
                            {activeRoster.length}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Total Pts
                        </div>
                        <div className={cn(
                            "text-xl sm:text-2xl md:text-3xl font-black",
                            activeTab === 'home' ? "text-orange-500" : "text-white"
                        )}>
                            {totalPoints}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Total Fouls
                        </div>
                        <div className="text-xl sm:text-2xl md:text-3xl font-black">
                            {totalFouls}
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Stats Table */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                {activeRoster.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Users size={48} className="mb-4 opacity-50" />
                        <p className="text-sm sm:text-base">No roster data available</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Table Header */}
                        <div className="grid grid-cols-[auto_1fr_repeat(3,auto)] gap-2 sm:gap-4 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            <div className="w-8 sm:w-10 text-center">#</div>
                            <div>Player</div>
                            <div className="text-center w-10 sm:w-12">PTS</div>
                            <div className="text-center w-10 sm:w-12">FOULS</div>
                            <div className="text-center w-14 sm:w-16">STATUS</div>
                        </div>

                        {/* Player Rows */}
                        {activeRoster
                            .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || parseInt(a.number) - parseInt(b.number))
                            .map((player) => (
                            <motion.div
                                key={player.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "grid grid-cols-[auto_1fr_repeat(3,auto)] gap-2 sm:gap-4 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl items-center",
                                    player.isActive 
                                        ? activeTab === 'home' 
                                            ? "bg-orange-500/10 border border-orange-500/20" 
                                            : "bg-white/5 border border-white/10"
                                        : "bg-slate-900/30 border border-slate-800/50 opacity-60"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-black text-sm sm:text-base",
                                    activeTab === 'home' ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-400"
                                )}>
                                    {player.number}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-sm sm:text-base truncate">
                                        {player.name}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-slate-500">
                                        {player.points > 0 && `${player.points} pts`}
                                        {player.points > 0 && player.fouls > 0 && ' • '}
                                        {player.fouls > 0 && `${player.fouls} fouls`}
                                    </div>
                                </div>
                                <div className="text-center w-10 sm:w-12">
                                    <span className={cn(
                                        "text-lg sm:text-xl font-black",
                                        player.points > 0 ? (activeTab === 'home' ? "text-orange-500" : "text-white") : "text-slate-600"
                                    )}>
                                        {player.points}
                                    </span>
                                </div>
                                <div className="text-center w-10 sm:w-12">
                                    <span className={cn(
                                        "text-lg sm:text-xl font-black",
                                        player.fouls >= 5 ? "text-red-500" : player.fouls > 0 ? "text-slate-300" : "text-slate-600"
                                    )}>
                                        {player.fouls}
                                    </span>
                                </div>
                                <div className="text-center w-14 sm:w-16">
                                    {player.isActive ? (
                                        <span className={cn(
                                            "text-[8px] sm:text-[10px] font-black uppercase px-2 py-1 rounded-full",
                                            activeTab === 'home' 
                                                ? "bg-orange-500 text-white" 
                                                : "bg-white text-slate-950"
                                        )}>
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                            Bench
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Game Status Footer */}
            <div className="bg-black/40 border-t border-slate-800 p-2 sm:p-3 text-center">
                <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest">
                    {game.status === 'final' ? 'Final' : `Period ${game.currentPeriod} of ${game.totalPeriods}`}
                </div>
            </div>
        </div>
    );
}
