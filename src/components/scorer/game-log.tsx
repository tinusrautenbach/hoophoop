'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Target, Move, ShieldAlert, Timer, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type GameEvent = {
    id: string;
    type: 'score' | 'rebound' | 'assist' | 'steal' | 'block' | 'turnover' | 'foul';
    player?: string;
    team: 'home' | 'guest';
    value?: number;
    timestamp: Date;
};

interface GameLogProps {
    events: GameEvent[];
}

const iconMap = {
    score: <Target size={14} />,
    rebound: <Target size={14} className="text-blue-500" />,
    assist: <Move size={14} className="text-green-500" />,
    steal: <ShieldAlert size={14} className="text-purple-500" />,
    block: <ShieldAlert size={14} className="text-red-500" />,
    turnover: <RotateCcw size={14} className="text-slate-500" />,
    foul: <Timer size={14} className="text-orange-500" />,
};

export function GameLog({ events }: GameLogProps) {
    return (
        <div className="flex flex-col gap-1 p-2 bg-black/20 rounded-2xl border border-white/5">
            <h4 className="text-[8px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-1">Recent Actions</h4>
            <div className="flex flex-col gap-1">
                <AnimatePresence initial={false}>
                    {events.slice(0, 5).map((event) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-3 bg-slate-900/40 p-2 rounded-xl border border-white/5"
                        >
                            <div className="flex-shrink-0">{iconMap[event.type]}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold truncate">
                                    <span className={cn(event.team === 'home' ? 'text-orange-500' : 'text-slate-400')}>
                                        {event.player || (event.team === 'home' ? 'Home' : 'Guest')}
                                    </span>
                                    <span className="text-slate-600 mx-1">•</span>
                                    <span className="text-slate-200">
                                        {event.type.toUpperCase()} {event.value ? `+${event.value}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="text-[8px] font-mono text-slate-700">
                                {event.timestamp.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {events.length === 0 && (
                    <div className="text-[10px] text-slate-700 italic px-2 py-4 text-center">No actions yet</div>
                )}
            </div>
        </div>
    );
}
