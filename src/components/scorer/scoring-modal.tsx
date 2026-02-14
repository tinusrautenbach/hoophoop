'use client';

import { useState, useEffect } from 'react';
import { X, Users, ArrowLeftRight, Shirt } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

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

interface ScoringModalProps {
    game: Game;
    scoringFor: { points: number; isMiss?: boolean; side?: 'home' | 'guest' };
    onClose: () => void;
    onScore: (playerId: string | null, team: 'home' | 'guest') => void;
}

export function ScoringModal({ game, scoringFor, onClose, onScore }: ScoringModalProps) {
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'guest' | null>(scoringFor.side || null);

    const activePlayers = game.rosters.filter(
        r => r.team === selectedTeam && r.isActive
    ).slice(0, 5); // Limit to 5

    // Fill remaining slots if less than 5 active players (shouldn't happen with proper bench selection)
    const slots = [...activePlayers];
    
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[150] bg-background/90 backdrop-blur-xl p-4 flex flex-col items-center justify-center"
        >
            <div className="w-full max-w-md flex flex-col h-full max-h-[600px]">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-3xl font-black flex items-center gap-3">
                        <span className={cn(scoringFor.isMiss ? "text-slate-500" : "text-orange-500")}>
                            {scoringFor.isMiss ? '-' : '+'}{scoringFor.points}
                        </span>
                        <span className="uppercase tracking-tight">
                            {selectedTeam 
                                ? (selectedTeam === 'home' ? game.homeTeamName : game.guestTeamName)
                                : 'WHICH TEAM?'}
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-white bg-card rounded-full transition-all active:scale-95">
                        <X size={24} />
                    </button>
                </div>

                {!selectedTeam ? (
                    /* Team Selection */
                    <div className="grid grid-cols-1 gap-4 flex-1">
                        <button
                            onClick={() => setSelectedTeam('home')}
                            className="bg-orange-600/10 border-2 border-orange-500/50 hover:bg-orange-600/20 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
                        >
                            <div className="text-4xl font-black text-orange-500">{game.homeTeamName}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-orange-500/50">Home Team</div>
                        </button>
                        <button
                            onClick={() => setSelectedTeam('guest')}
                            className="bg-card/50 border-2 border-border hover:bg-card rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
                        >
                            <div className="text-4xl font-black text-slate-300">{game.guestTeamName}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Guest Team</div>
                        </button>
                    </div>
                ) : (
                    /* 6-Player Grid */
                    <div className="grid grid-cols-2 grid-rows-3 gap-3 flex-1 h-full">
                        {/* 5 Player Slots */}
                        {slots.map((player) => (
                            <button
                                key={player.id}
                                onClick={() => onScore(player.id, selectedTeam)}
                                className={cn(
                                    "relative rounded-2xl flex flex-col items-center justify-center p-4 transition-all active:scale-95 border-2",
                                    selectedTeam === 'home' 
                                        ? "bg-input border-border hover:border-orange-500" 
                                        : "bg-input border-border hover:border-slate-400"
                                )}
                            >
                                <span className={cn(
                                    "text-5xl font-black mb-1",
                                    selectedTeam === 'home' ? "text-orange-500" : "text-slate-300"
                                )}>
                                    {player.number}
                                </span>
                                <span className="text-xs font-bold uppercase truncate w-full text-center text-slate-500">
                                    {player.name}
                                </span>
                            </button>
                        ))}

                        {/* 6th Slot: Opponent (Switch Team) */}
                        <button
                            onClick={() => setSelectedTeam(selectedTeam === 'home' ? 'guest' : 'home')}
                            className="rounded-2xl flex flex-col items-center justify-center p-4 transition-all active:scale-95 bg-card border-2 border-dashed border-slate-600 group"
                        >
                            <ArrowLeftRight size={32} className="text-slate-500 mb-2 group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">
                                Opponent
                            </span>
                            <span className="text-[8px] font-bold uppercase text-slate-600">
                                Switch to {selectedTeam === 'home' ? game.guestTeamName : game.homeTeamName}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
