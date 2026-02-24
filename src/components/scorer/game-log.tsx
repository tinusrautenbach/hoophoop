'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Move, ShieldAlert, Timer, RotateCcw, Users, ChevronDown, ChevronUp, Edit2, Trash2, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type GameEvent = {
    id: string;
    type: 'score' | 'rebound' | 'assist' | 'steal' | 'block' | 'turnover' | 'foul' | 'timeout' | 'sub' | 'miss' | 'period_start' | 'period_end' | 'clock_start' | 'clock_stop' | 'undo' | 'game_end';
    player?: string;
    team: 'home' | 'guest';
    value?: number;
    description?: string;
    timestamp: Date;
    clockAt?: number;
    period?: number;
    metadata?: Record<string, unknown>;
};

interface GameLogProps {
    events: GameEvent[];
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
    limit?: number;
    onHeaderClick?: () => void;
    hideHeader?: boolean;
}

const iconMap = {
    score: <Target size={14} />,
    rebound: <Target size={14} className="text-blue-500" />,
    assist: <Move size={14} className="text-green-500" />,
    steal: <ShieldAlert size={14} className="text-purple-500" />,
    block: <ShieldAlert size={14} className="text-red-500" />,
    turnover: <RotateCcw size={14} className="text-slate-500" />,
    foul: <Timer size={14} className="text-orange-500" />,
    timeout: <Timer size={14} className="text-blue-400" />,
    sub: <Users size={14} className="text-indigo-400" />,
    miss: <ShieldAlert size={14} className="text-slate-600" />,
    period_start: <Clock size={14} className="text-white" />,
    period_end: <Clock size={14} className="text-slate-500" />,
    clock_start: <Clock size={14} className="text-green-500" />,
    clock_stop: <Clock size={14} className="text-red-500" />,
    undo: <RotateCcw size={14} className="text-slate-500" />,
    game_end: <Target size={14} className="text-red-500" />,
};

export function GameLog({ events, onDelete, onEdit, limit, onHeaderClick, hideHeader = false }: GameLogProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Reverse events so latest are at the top
    const reversedEvents = [...events].reverse();
    const displayedEvents = limit ? reversedEvents.slice(0, limit) : reversedEvents;

    return (
        <div className="flex flex-col gap-1 p-2 bg-black/20 rounded-2xl border border-white/5">
            {!hideHeader && (
                <button
                    disabled={!onHeaderClick}
                    onClick={onHeaderClick}
                    className={cn(
                        "flex items-center justify-between w-full px-2 py-1 transition-colors",
                        onHeaderClick ? "hover:bg-white/5 rounded-lg text-left group" : "cursor-default"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <h4 className="text-[10px] font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-widest transition-colors">
                            Game Log {events.length > 0 && `(${events.length})`}
                        </h4>
                        {limit && events.length > limit && (
                            <span className="text-[8px] font-bold text-orange-500/60 uppercase tracking-tighter ring-1 ring-orange-500/20 px-1.5 rounded-full">Recent</span>
                        )}
                    </div>
                    {onHeaderClick && (
                        <div className="text-[8px] font-black text-orange-500 group-hover:text-orange-400 uppercase tracking-widest">
                            View Full Log
                        </div>
                    )}
                </button>
            )}

            <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar pb-2">
                <AnimatePresence initial={false}>
                    {displayedEvents.map((event) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                                "flex flex-col bg-input/40 rounded-xl border border-white/5 overflow-hidden transition-all",
                                expandedId === event.id ? "ring-1 ring-orange-500/50 bg-input shadow-lg shadow-orange-500/10" : "hover:bg-input/60"
                            )}
                        >
                            <div
                                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                                className="flex items-center gap-3 p-2 cursor-pointer"
                            >
                                <div className="flex-shrink-0">{iconMap[event.type]}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold truncate">
                                        <span className={cn(event.team === 'home' ? 'text-orange-500' : 'text-slate-400')}>
                                            {event.player || (event.team === 'home' ? 'Home' : 'Guest')}
                                        </span>
                                        <span className="text-slate-600 mx-1">•</span>
                                        <span className="text-slate-200">
                                            {(event.description || event.type).toUpperCase()} {event.value ? (event.type === 'miss' ? `-${event.value}` : `+${event.value}`) : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[8px] font-mono text-slate-700">
                                    {event.period ? `P${event.period} ` : ''}
                                    {event.clockAt ? `${Math.floor(event.clockAt / 60)}:${(event.clockAt % 60).toString().padStart(2, '0')}` : event.timestamp.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedId === event.id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-8 flex gap-4 justify-between items-center bg-black/40 border-t border-white/5"
                                    >
                                        {onEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(event.id); }}
                                                className="flex-1 py-6 flex flex-col items-center gap-2 bg-card hover:bg-muted rounded-2xl text-slate-300 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl ring-1 ring-white/10"
                                            >
                                                <Edit2 size={24} className="mb-1" />
                                                Edit Action
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete this action?')) {
                                                        onDelete(event.id);
                                                        setExpandedId(null);
                                                    }
                                                }}
                                                className="flex-1 py-6 flex flex-col items-center gap-2 bg-red-950/40 hover:bg-red-900/60 rounded-2xl text-red-500 border border-red-500/20 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl"
                                            >
                                                <Trash2 size={24} className="mb-1" />
                                                Delete
                                            </button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
