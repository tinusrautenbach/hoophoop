'use client';

import { X, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    isActive: boolean;
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    rosters: RosterEntry[];
};

interface SubsModalProps {
    game: Game;
    onClose: () => void;
    onSub: (playerId: string) => void;
    onAmendRoster: () => void; // For Phase 9.4
}

export function SubsModal({ game, onClose, onSub, onAmendRoster }: SubsModalProps) {
    
    const renderTeamSection = (team: 'home' | 'guest', teamName: string, colorClass: string) => {
        const teamRoster = game.rosters.filter(r => r.team === team);
        const active = teamRoster.filter(r => r.isActive);
        const bench = teamRoster.filter(r => !r.isActive);

        return (
            <div className="space-y-4">
                <h4 className={cn("text-sm font-black uppercase tracking-widest px-2", colorClass)}>
                    {teamName}
                </h4>

                {/* On Court */}
                <div className="bg-input/50 rounded-2xl p-4 border border-border">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        On Court ({active.length})
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        {active.map(player => (
                            <button
                                key={player.id}
                                onClick={() => onSub(player.id)}
                                className={cn(
                                    "aspect-[3/4] rounded-xl border transition-all flex flex-col items-center justify-center gap-1 active:scale-95 relative overflow-hidden group",
                                    team === 'home' ? "bg-orange-500/20 border-orange-500 text-orange-100" : "bg-slate-100 border-white text-slate-950"
                                )}
                            >
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowDown size={12} className={team === 'home' ? "text-orange-300" : "text-slate-500"} />
                                </div>
                                <div className="text-xl font-black leading-none">{player.number}</div>
                                <div className="text-[9px] font-bold truncate w-full text-center px-1">{player.name}</div>
                            </button>
                        ))}
                        {active.length === 0 && (
                            <div className="col-span-5 py-4 text-center text-xs italic text-slate-600">
                                No active players
                            </div>
                        )}
                    </div>
                </div>

                {/* Bench */}
                <div className="bg-input/30 rounded-2xl p-4 border border-border/50">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted" />
                        Bench ({bench.length})
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {bench.map(player => (
                            <button
                                key={player.id}
                                onClick={() => onSub(player.id)}
                                className="aspect-[3/4] bg-background border border-border rounded-xl flex flex-col items-center justify-center gap-1 hover:border-slate-600 transition-all active:scale-95 group relative"
                            >
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowUp size={12} className="text-green-500" />
                                </div>
                                <div className="text-xl font-black text-slate-500 group-hover:text-white transition-colors">{player.number}</div>
                                <div className="text-[9px] font-bold text-slate-600 truncate w-full text-center px-1 group-hover:text-slate-400 transition-colors">{player.name}</div>
                            </button>
                        ))}
                        {bench.length === 0 && (
                            <div className="col-span-full py-4 text-center text-xs italic text-slate-600">
                                Empty bench
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl p-6 flex flex-col"
        >
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">Substitution Manager</h3>
                <div className="flex gap-2">
                    {/* Phase 9.4: Amend Roster Button */}
                    <button 
                        onClick={onAmendRoster}
                        className="px-4 py-2 bg-card hover:bg-muted rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                        Amend Roster
                    </button>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-card rounded-full">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pb-20 custom-scrollbar">
                {renderTeamSection('home', game.homeTeamName, 'text-orange-500')}
                {renderTeamSection('guest', game.guestTeamName, 'text-slate-400')}
            </div>

            <button
                onClick={onClose}
                className="bg-orange-600 font-black py-4 rounded-2xl shadow-xl shadow-orange-600/20 shrink-0 hover:bg-orange-500 transition-colors"
            >
                DONE
            </button>
        </motion.div>
    );
}
