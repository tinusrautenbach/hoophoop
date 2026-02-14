'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Plus, Trash2, Shield, Eye, ShieldAlert } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Scorer = {
    id: string;
    userId: string;
    role: 'owner' | 'co_scorer' | 'viewer';
    joinedAt: string;
};

interface ScorerManagerProps {
    gameId: string;
    ownerId: string;
    currentUserId?: string | null;
    scorers: Scorer[];
    isOpen: boolean;
    onClose: () => void;
    onAddScorer: (userId: string) => void;
    onRemoveScorer: (scorerId: string) => void;
}

export function ScorerManager({
    gameId,
    ownerId,
    currentUserId,
    scorers,
    isOpen,
    onClose,
    onAddScorer,
    onRemoveScorer
}: ScorerManagerProps) {
    const [newScorerId, setNewScorerId] = useState('');
    const [error, setError] = useState('');

    const handleAdd = () => {
        if (!newScorerId.trim()) {
            setError('User ID is required');
            return;
        }
        onAddScorer(newScorerId);
        setNewScorerId('');
        setError('');
    };

    const isOwner = currentUserId === ownerId;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[150] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-input border border-white/10 rounded-[32px] p-8 max-w-md w-full relative shadow-2xl"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <Users size={24} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Game Scorers</h3>
                                <p className="text-slate-500 text-sm">Manage who can control this game</p>
                            </div>
                        </div>

                        {/* Add Scorer Form */}
                        {isOwner && (
                            <div className="mb-8">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                                    Add Co-Scorer
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newScorerId}
                                        onChange={(e) => setNewScorerId(e.target.value)}
                                        placeholder="Enter User ID"
                                        className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        onClick={handleAdd}
                                        className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition-colors"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                            </div>
                        )}

                        {/* Scorers List */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">
                                Authorized Users
                            </label>
                            
                            {/* Owner */}
                            <div className="bg-background/50 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield size={16} className="text-yellow-500" />
                                    <div>
                                        <div className="font-bold text-sm">Owner</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{ownerId}</div>
                                    </div>
                                </div>
                                {currentUserId === ownerId && (
                                    <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">YOU</span>
                                )}
                            </div>

                            {/* Co-Scorers */}
                            {scorers.map((scorer) => (
                                <div key={scorer.id} className="bg-background/50 border border-border rounded-xl p-4 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        {scorer.role === 'viewer' ? (
                                            <Eye size={16} className="text-slate-500" />
                                        ) : (
                                            <ShieldAlert size={16} className="text-blue-500" />
                                        )}
                                        <div>
                                            <div className="font-bold text-sm capitalize">{scorer.role.replace('_', ' ')}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{scorer.userId}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {scorer.userId === currentUserId && (
                                            <span className="text-[10px] font-bold bg-card text-slate-400 px-2 py-1 rounded">YOU</span>
                                        )}
                                        {isOwner && (
                                            <button
                                                onClick={() => onRemoveScorer(scorer.id)}
                                                className="p-2 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {scorers.length === 0 && (
                                <div className="text-center py-4 text-slate-500 text-xs italic">
                                    No other scorers added yet.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
