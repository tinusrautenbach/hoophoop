'use client';

import { ShieldAlert } from 'lucide-react';
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
    mode: 'simple' | 'advanced';
    rosters: RosterEntry[];
};

interface SimpleScorerProps {
    game: Game;
    handleScore: (points: number, side?: 'home' | 'guest', isMiss?: boolean) => void;
    handleFoul: (side: 'home' | 'guest') => void;
}

export function SimpleScorer({ game, handleScore, handleFoul }: SimpleScorerProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Score Display Row */}
            <div className="flex border-b border-slate-900 bg-black/20">
                <div className="flex-1 p-4 text-center">
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-orange-500 truncate">
                        {game.homeTeamName}
                    </h2>
                    <div className="text-6xl font-black mt-1 font-mono tracking-tighter">{game.homeScore}</div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <div className={cn(
                            "px-2 py-0.1 rounded text-[10px] font-bold uppercase tracking-widest border transition-all",
                            game.homeFouls >= 5 ? "bg-red-500 border-red-400 text-white animate-pulse" : "border-border text-slate-500"
                        )}>
                            Bonus
                        </div>
                        <div className="text-lg font-black font-mono text-slate-400">
                            {game.homeFouls}
                        </div>
                    </div>
                </div>

                <div className="w-[1px] bg-input self-stretch" />

                <div className="flex-1 p-4 text-center">
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-slate-400 truncate">
                        {game.guestTeamName}
                    </h2>
                    <div className="text-6xl font-black mt-1 font-mono tracking-tighter text-slate-300">{game.guestScore}</div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <div className={cn(
                            "px-2 py-0.1 rounded text-[10px] font-bold uppercase tracking-widest border transition-all",
                            game.guestFouls >= 5 ? "bg-red-500 border-red-400 text-white animate-pulse" : "border-border text-slate-500"
                        )}>
                            Bonus
                        </div>
                        <div className="text-lg font-black font-mono text-slate-400">
                            {game.guestFouls}
                        </div>
                    </div>
                </div>
            </div>

            {/* Central Scoring Area */}
            <div className="flex-1 p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 h-full">
                    <button
                        onClick={() => handleScore(2)}
                        className="bg-card hover:bg-muted active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-6 gap-2 border-2 border-border/50 group"
                    >
                        <span className="text-5xl font-black group-hover:scale-110 transition-transform">+2</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Points</span>
                    </button>
                    <button
                        onClick={() => handleScore(3)}
                        className="bg-card hover:bg-muted active:scale-95 transition-all rounded-3xl flex flex-col items-center justify-center p-6 gap-2 border-2 border-orange-500/30 group"
                    >
                        <span className="text-5xl font-black text-orange-500 group-hover:scale-110 transition-transform">+3</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Points</span>
                    </button>

                    <button
                        onClick={() => handleScore(2, undefined, true)}
                        className="bg-input border border-border hover:bg-card active:scale-95 transition-all rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group opacity-60 hover:opacity-100"
                    >
                        <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-2</span>
                        <span className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">Miss</span>
                    </button>
                    <button
                        onClick={() => handleScore(3, undefined, true)}
                        className="bg-input border border-border hover:bg-card active:scale-95 transition-all rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group opacity-60 hover:opacity-100"
                    >
                        <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-3</span>
                        <span className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">Miss</span>
                    </button>

                    <button
                        onClick={() => handleScore(1)}
                        className="bg-input border-2 border-border hover:bg-card active:scale-95 transition-all rounded-2xl p-4 font-black flex flex-col items-center justify-center gap-1"
                    >
                        <span className="text-3xl">+1</span>
                        <span className="text-slate-500 text-[8px] uppercase font-bold">Free Throw</span>
                    </button>
                    <button
                        onClick={() => handleScore(1, undefined, true)}
                        className="bg-input border border-border hover:bg-card active:scale-95 transition-all rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group opacity-60 hover:opacity-100"
                    >
                        <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-1</span>
                        <span className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">Miss</span>
                    </button>
                </div>

                {/* Team Specific Actions (Fouls) */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleFoul('home')}
                        className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center text-red-500"
                    >
                        <span className="text-[10px] uppercase tracking-widest">Home Foul</span>
                        <ShieldAlert size={18} />
                    </button>
                    <button
                        onClick={() => handleFoul('guest')}
                        className="bg-input border border-border hover:bg-card active:scale-95 transition-all rounded-2xl p-4 font-black flex justify-between items-center"
                    >
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">Guest Foul</span>
                        <ShieldAlert size={18} className="text-slate-700" />
                    </button>
                </div>
            </div>
        </div>
    );
}
