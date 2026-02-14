'use client';

import { useState } from 'react';
import { X, Settings, Eye, Globe, Users2, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type GameSettings = {
    name: string | null;
    scheduledDate: string | null;
    visibility: 'private' | 'public_general' | 'public_community';
    homeTeamName: string;
    guestTeamName: string;
    mode: 'simple' | 'advanced';
    totalPeriods: number;
    periodSeconds: number;
    totalTimeouts: number;
    ownerId?: string;
    community?: {
        id: string;
        name: string;
        ownerId: string;
        members?: { userId: string; role: string }[];
    } | null;
};

interface GameSettingsModalProps {
    game: GameSettings;
    onClose: () => void;
    onSave: (settings: Partial<GameSettings>) => void;
    isSaving?: boolean;
    onDelete?: () => void;
    canDelete?: boolean;
}

export function GameSettingsModal({ game, onClose, onSave, isSaving, onDelete, canDelete }: GameSettingsModalProps) {
    const [formData, setFormData] = useState({
        name: game.name || '',
        scheduledDate: game.scheduledDate ? new Date(game.scheduledDate).toISOString().split('T')[0] : '',
        visibility: game.visibility,
        homeTeamName: game.homeTeamName,
        guestTeamName: game.guestTeamName,
        mode: game.mode,
        totalPeriods: game.totalPeriods,
        periodSeconds: game.periodSeconds,
        totalTimeouts: game.totalTimeouts,
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates: Partial<GameSettings> = {};
        
        if (formData.name !== game.name) updates.name = formData.name || undefined;
        if (formData.scheduledDate !== (game.scheduledDate ? new Date(game.scheduledDate).toISOString().split('T')[0] : '')) {
            updates.scheduledDate = formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : null;
        }
        if (formData.visibility !== game.visibility) updates.visibility = formData.visibility;
        if (formData.homeTeamName !== game.homeTeamName) updates.homeTeamName = formData.homeTeamName;
        if (formData.guestTeamName !== game.guestTeamName) updates.guestTeamName = formData.guestTeamName;
        if (formData.mode !== game.mode) updates.mode = formData.mode;
        if (formData.totalPeriods !== game.totalPeriods) updates.totalPeriods = formData.totalPeriods;
        if (formData.periodSeconds !== game.periodSeconds) updates.periodSeconds = formData.periodSeconds;
        if (formData.totalTimeouts !== game.totalTimeouts) updates.totalTimeouts = formData.totalTimeouts;
        
        onSave(updates);
    };

    const formatTimeDisplay = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        return `${mins}:00`;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-input border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Settings size={20} className="text-orange-500" />
                        <h2 className="text-lg font-bold">Game Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                    {/* Game Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Game Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Championship Final"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                        />
                    </div>

                    {/* Scheduled Date */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                            <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                Scheduled Date
                            </div>
                        </label>
                        <input
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                        />
                    </div>

                    {/* Visibility */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Visibility
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'private' })}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                                    formData.visibility === 'private'
                                        ? "bg-card border-orange-500 text-white"
                                        : "bg-background border-border text-slate-500 hover:border-border"
                                )}
                            >
                                <Eye size={20} />
                                <span className="text-xs font-bold">Private</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'public_general' })}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                                    formData.visibility === 'public_general'
                                        ? "bg-green-500/20 border-green-500 text-green-400"
                                        : "bg-background border-border text-slate-500 hover:border-border"
                                )}
                            >
                                <Globe size={20} />
                                <span className="text-xs font-bold">Public</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'public_community' })}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                                    formData.visibility === 'public_community'
                                        ? "bg-blue-500/20 border-blue-500 text-blue-400"
                                        : "bg-background border-border text-slate-500 hover:border-border"
                                )}
                            >
                                <Users2 size={20} />
                                <span className="text-xs font-bold">Community</span>
                            </button>
                        </div>
                    </div>

                    {/* Team Names */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-orange-500/60 mb-2">
                                Home Team
                            </label>
                            <input
                                type="text"
                                value={formData.homeTeamName}
                                onChange={(e) => setFormData({ ...formData, homeTeamName: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Guest Team
                            </label>
                            <input
                                type="text"
                                value={formData.guestTeamName}
                                onChange={(e) => setFormData({ ...formData, guestTeamName: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Game Mode */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Scoring Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, mode: 'simple' })}
                                className={cn(
                                    "p-3 rounded-xl border transition-all text-sm font-bold",
                                    formData.mode === 'simple'
                                        ? "bg-card border-orange-500 text-white"
                                        : "bg-background border-border text-slate-500 hover:border-border"
                                )}
                            >
                                Simple (Points & Fouls)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, mode: 'advanced' })}
                                className={cn(
                                    "p-3 rounded-xl border transition-all text-sm font-bold",
                                    formData.mode === 'advanced'
                                        ? "bg-card border-orange-500 text-white"
                                        : "bg-background border-border text-slate-500 hover:border-border"
                                )}
                            >
                                Advanced (Full Stats)
                            </button>
                        </div>
                    </div>

                    {/* Period Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Periods
                            </label>
                            <select
                                value={formData.totalPeriods}
                                onChange={(e) => setFormData({ ...formData, totalPeriods: parseInt(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                            >
                                <option value={1}>1 Period</option>
                                <option value={2}>2 Periods</option>
                                <option value={4}>4 Periods</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Period Length
                            </label>
                            <select
                                value={formData.periodSeconds}
                                onChange={(e) => setFormData({ ...formData, periodSeconds: parseInt(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                            >
                                <option value={600}>10 Minutes</option>
                                <option value={720}>12 Minutes</option>
                                <option value={900}>15 Minutes</option>
                                <option value={1200}>20 Minutes</option>
                            </select>
                        </div>
                    </div>

                    {/* Timeouts */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Timeouts Per Team
                        </label>
                        <div className="flex gap-2">
                            {[2, 3, 4, 5].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, totalTimeouts: num })}
                                    className={cn(
                                        "flex-1 p-2 rounded-lg border transition-all font-bold",
                                        formData.totalTimeouts === num
                                            ? "bg-card border-orange-500 text-white"
                                            : "bg-background border-border text-slate-500 hover:border-border"
                                    )}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Danger Zone - Delete Game */}
                {canDelete && onDelete && (
                    <div className="p-4 border-t border-red-900/30 bg-red-950/10">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={16} className="text-red-500" />
                            <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Danger Zone</span>
                        </div>
                        {!showDeleteConfirm ? (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 rounded-lg font-bold text-sm transition-colors"
                            >
                                <Trash2 size={16} />
                                Delete Game
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-red-400/80">
                                    Are you sure? This will hide the game from all lists. It can be restored by a community admin or world admin.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isDeleting}
                                        className="flex-1 px-4 py-2 bg-muted hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setIsDeleting(true);
                                            await onDelete();
                                            setIsDeleting(false);
                                        }}
                                        disabled={isDeleting}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-bold text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-muted text-white rounded-lg font-bold text-sm transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
