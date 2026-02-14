'use client';

import { useState } from 'react';
import { Check, Users, ArrowRight, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    isActive: boolean;
    points: number;
    fouls: number;
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    rosters: RosterEntry[];
};

interface BenchSelectionProps {
    game: Game;
    onStartGame: (updatedRosters: RosterEntry[]) => void;
    onCancel?: () => void;
}

export function BenchSelection({ game, onStartGame, onCancel }: BenchSelectionProps) {
    // Initialize state with all players active by default, or respect existing isActive state if previously set
    const [rosters, setRosters] = useState<RosterEntry[]>(
        game.rosters.map(r => ({ ...r, isActive: true }))
    );

    const togglePlayer = (playerId: string) => {
        setRosters(prev => prev.map(r => 
            r.id === playerId ? { ...r, isActive: !r.isActive } : r
        ));
    };

    const handleStart = () => {
        onStartGame(rosters);
    };

    const homeRoster = rosters.filter(r => r.team === 'home');
    const guestRoster = rosters.filter(r => r.team === 'guest');

    return (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col font-sans select-none touch-none overflow-hidden">
            {/* Header */}
            <div className="bg-black/40 border-b border-border p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-500/10 p-2 rounded-xl">
                        <Users className="text-orange-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight leading-none">Pre-Game Check</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Select Active Players</p>
                    </div>
                </div>
                {onCancel && (
                    <button onClick={onCancel} className="p-2 text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                )}
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
                    {/* Home Team */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-input/50 p-4 rounded-2xl border border-border sticky top-0 backdrop-blur-md z-10">
                            <h3 className="font-black text-xl uppercase tracking-widest text-orange-500 truncate">
                                {game.homeTeamName}
                            </h3>
                            <div className="text-xs font-bold bg-card text-slate-400 px-2 py-1 rounded-lg">
                                {homeRoster.filter(r => r.isActive).length} Active
                            </div>
                        </div>

                        <div className="grid gap-2">
                            {homeRoster.length === 0 ? (
                                <div className="text-center py-8 text-slate-600 italic text-sm">No players on roster</div>
                            ) : (
                                homeRoster.map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => togglePlayer(player.id)}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all active:scale-[0.99]",
                                            player.isActive 
                                                ? "bg-orange-500/10 border-orange-500/50 hover:bg-orange-500/20" 
                                                : "bg-input border-border opacity-60 hover:opacity-80"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                            player.isActive 
                                                ? "bg-orange-500 border-orange-500 text-white" 
                                                : "border-slate-600"
                                        )}>
                                            {player.isActive && <Check size={14} strokeWidth={4} />}
                                        </div>
                                        <div className="text-2xl font-black font-mono w-12 text-center text-slate-300">
                                            {player.number}
                                        </div>
                                        <div className={cn(
                                            "font-bold text-lg truncate flex-1 text-left",
                                            player.isActive ? "text-white" : "text-slate-500"
                                        )}>
                                            {player.name}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Guest Team */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-input/50 p-4 rounded-2xl border border-border sticky top-0 backdrop-blur-md z-10">
                            <h3 className="font-black text-xl uppercase tracking-widest text-slate-400 truncate">
                                {game.guestTeamName}
                            </h3>
                            <div className="text-xs font-bold bg-card text-slate-400 px-2 py-1 rounded-lg">
                                {guestRoster.filter(r => r.isActive).length} Active
                            </div>
                        </div>

                        <div className="grid gap-2">
                            {guestRoster.length === 0 ? (
                                <div className="text-center py-8 text-slate-600 italic text-sm">No players on roster</div>
                            ) : (
                                guestRoster.map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => togglePlayer(player.id)}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all active:scale-[0.99]",
                                            player.isActive 
                                                ? "bg-card border-white/20 hover:bg-muted" 
                                                : "bg-input border-border opacity-60 hover:opacity-80"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                            player.isActive 
                                                ? "bg-white border-white text-slate-950" 
                                                : "border-slate-600"
                                        )}>
                                            {player.isActive && <Check size={14} strokeWidth={4} />}
                                        </div>
                                        <div className="text-2xl font-black font-mono w-12 text-center text-slate-300">
                                            {player.number}
                                        </div>
                                        <div className={cn(
                                            "font-bold text-lg truncate flex-1 text-left",
                                            player.isActive ? "text-white" : "text-slate-500"
                                        )}>
                                            {player.name}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-input border-t border-border shrink-0">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={handleStart}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xl"
                    >
                        Start Game
                        <ArrowRight size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
}
