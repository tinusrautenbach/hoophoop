'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Calendar, Layout, Info, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const TOURNAMENT_TYPES = [
    { id: 'round_robin', name: 'Round Robin', description: 'Each team plays every other team once.' },
    { id: 'single_elimination', name: 'Single Elimination', description: 'Knockout bracket, loser eliminated immediately.' },
    { id: 'double_elimination', name: 'Double Elimination', description: 'Teams eliminated after 2 losses.' },
    { id: 'pool_knockout', name: 'Pool + Knockout', description: 'Round robin pools followed by knockout bracket.' },
];

export default function CreateTournament() {
    const { id: communityId } = useParams();
    const router = useRouter();
    
    const [name, setName] = useState('');
    const [type, setType] = useState('round_robin');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type,
                    startDate,
                    endDate,
                    description,
                    communityId
                }),
            });

            if (res.ok) {
                router.push(`/communities/${communityId}?tab=tournaments`);
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create tournament');
            }
        } catch (error) {
            console.error('Error creating tournament:', error);
            alert('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-8">
            <button 
                onClick={() => router.back()} 
                className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
            >
                <ArrowLeft size={20} />
                Back
            </button>

            <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">Create Tournament</h1>
                <p className="text-slate-500">Set up a new tournament for your community.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-input border border-border rounded-3xl p-6 sm:p-8 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-wider text-xs">
                            <Info size={14} />
                            Basic Information
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-400 ml-1">Tournament Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Summer Championship 2026"
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-400 ml-1">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the tournament rules, prizes, etc."
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors min-h-[100px]"
                            />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-wider text-xs">
                            <Calendar size={14} />
                            Schedule
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-400 ml-1">Start Date</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors pointer-events-none" size={18} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-400 ml-1">End Date</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors pointer-events-none" size={18} />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {startDate && endDate && (
                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Clock className="text-orange-500" size={18} />
                                    <div className="text-sm">
                                        <span className="text-slate-400">Tournament Duration:</span>
                                        <span className="text-white font-bold ml-2">
                                            {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500/50">Auto-calculated</div>
                            </div>
                        )}
                    </div>

                    {/* Tournament Type */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-wider text-xs">
                            <Layout size={14} />
                            Tournament Format
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {TOURNAMENT_TYPES.map((t) => (
                                <div
                                    key={t.id}
                                    onClick={() => setType(t.id)}
                                    className={cn(
                                        "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-1",
                                        type === t.id 
                                            ? "border-orange-500 bg-orange-500/5" 
                                            : "border-border bg-background hover:border-slate-700"
                                    )}
                                >
                                    <div className="font-bold flex items-center justify-between">
                                        {t.name}
                                        {type === t.id && <Trophy size={16} className="text-orange-500" />}
                                    </div>
                                    <div className="text-xs text-slate-500">{t.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-orange-900/20"
                >
                    {loading ? 'Creating...' : 'Create Tournament'}
                </button>
            </form>
        </div>
    );
}
