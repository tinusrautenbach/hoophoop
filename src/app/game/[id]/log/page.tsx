'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { motion } from 'framer-motion';
import { ArrowLeft, History, Search } from 'lucide-react';
import { GameLog, type GameEvent } from '@/components/scorer/game-log';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function SpectatorLogPage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket } = useSocket(id as string);

    const [game, setGame] = useState<any>(null);
    const [events, setEvents] = useState<GameEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                if (data.events) {
                    setEvents(data.events.map((e: any) => ({
                        ...e,
                        timestamp: new Date(e.createdAt || e.timestamp)
                    })));
                }
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!socket) return;
        socket.on('event-added', (event: GameEvent) => {
            const newEvent = { ...event, timestamp: new Date(event.timestamp) };
            setEvents(prev => [newEvent, ...prev]);
        });
        socket.on('game-updated', (updates: any) => {
            if (updates.deleteEventId) {
                setEvents(prev => prev.filter(e => e.id !== updates.deleteEventId));
            }
            if (updates.updatedEvent) {
                setEvents(prev => prev.map(e => e.id === updates.updatedEvent.id ? {
                    ...updates.updatedEvent,
                    timestamp: new Date(updates.updatedEvent.timestamp)
                } : e));
            }
        });
    }, [socket]);

    const filteredEvents = events.filter(e => {
        const matchesSearch = e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.player?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || e.type === filterType;
        return matchesSearch && matchesType;
    });

    if (loading || !game) return (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Timeline...</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="bg-black/40 border-b border-border p-4 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push(`/game/${id}`)}
                        className="p-2 text-slate-500 hover:text-white bg-input rounded-xl border border-white/5 transition-all active:scale-95"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-white leading-none">Game Timeline</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            {game.homeTeamName} vs {game.guestTeamName}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-input/50 border-b border-white/5 p-4 shrink-0 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-4 max-w-4xl mx-auto">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input
                            type="text"
                            placeholder="Search events, players..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {['all', 'score', 'foul', 'timeout', 'sub'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    filterType === type
                                        ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
                                        : "bg-card text-slate-500 hover:text-slate-300"
                                )}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Log View */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex justify-center pb-20">
                <div className="w-full max-w-2xl space-y-2">
                    {filteredEvents.length > 0 ? (
                        <GameLog events={filteredEvents} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                            <History size={48} className="text-slate-800 mb-4" />
                            <h3 className="text-lg font-black uppercase text-slate-700">No matching events</h3>
                            <p className="text-sm text-slate-800">Try adjusting your filters or search query</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Stats Summary */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-white/5 p-4 flex items-center justify-center gap-8 z-10">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Total Actions</span>
                    <span className="text-xl font-black text-white">{events.length}</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Scoring Events</span>
                    <span className="text-xl font-black text-orange-500">{events.filter(e => e.type === 'score').length}</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Stoppages</span>
                    <span className="text-xl font-black text-blue-400">{events.filter(e => ['timeout', 'foul'].includes(e.type)).length}</span>
                </div>
            </div>
        </div>
    );
}
