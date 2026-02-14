'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, UserPlus, User } from 'lucide-react';
import Link from 'next/link';
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

interface AmendRosterModalProps {
    game: Game;
    onClose: () => void;
    onAddPlayer: (player: { name: string, number: string, team: 'home' | 'guest' }) => void;
    onUpdatePlayer: (id: string, updates: { number?: string, name?: string }) => void;
    onRemovePlayer: (id: string) => void;
}

export function AmendRosterModal({ game, onClose, onAddPlayer, onUpdatePlayer, onRemovePlayer }: AmendRosterModalProps) {
    const [view, setView] = useState<'list' | 'add'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNumber, setEditNumber] = useState('');
    const [editName, setEditName] = useState('');
    
    // Add Player Form State
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerNumber, setNewPlayerNumber] = useState('');
    const [newPlayerTeam, setNewPlayerTeam] = useState<'home' | 'guest'>('home');

    const handleEditStart = (player: RosterEntry) => {
        setEditingId(player.id);
        setEditNumber(player.number);
        setEditName(player.name);
    };

    const handleEditSave = (id: string) => {
        onUpdatePlayer(id, { number: editNumber, name: editName });
        setEditingId(null);
    };

    const handleAddSubmit = () => {
        if (!newPlayerName || !newPlayerNumber) return;
        onAddPlayer({
            name: newPlayerName,
            number: newPlayerNumber,
            team: newPlayerTeam
        });
        // Reset form
        setNewPlayerName('');
        setNewPlayerNumber('');
        setView('list');
    };

    const renderRosterList = (team: 'home' | 'guest', teamName: string) => (
        <div className="space-y-2">
            <h4 className={cn("text-xs font-black uppercase tracking-widest px-2", team === 'home' ? "text-orange-500" : "text-slate-400")}>
                {teamName}
            </h4>
            <div className="space-y-2">
                {game.rosters.filter(r => r.team === team).map((player, idx) => (
                    <div key={player.id || `roster-${idx}`} className="flex flex-col gap-2 bg-input/50 p-3 rounded-xl border border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {editingId === player.id ? (
                                    <input
                                        type="text"
                                        value={editNumber}
                                        onChange={(e) => setEditNumber(e.target.value)}
                                        className="w-12 bg-card border border-border rounded text-center font-mono font-bold text-white focus:border-orange-500 focus:outline-none py-1"
                                        autoFocus
                                        onBlur={() => {
                                            // Optional: could save on blur, but we have two fields now
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(player.id)}
                                    />
                                ) : (
                                    <button
                                        onClick={() => handleEditStart(player)}
                                        className="w-8 h-8 flex items-center justify-center font-mono font-bold text-slate-400 hover:text-white hover:bg-card rounded transition-colors shrink-0"
                                    >
                                        {player.number}
                                    </button>
                                )}
                                
                                {editingId === player.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1 bg-card border border-border rounded px-2 font-bold text-white focus:border-orange-500 focus:outline-none py-1 min-w-0"
                                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(player.id)}
                                    />
                                ) : (
                                    <div className="text-sm font-bold truncate">{player.name}</div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                {editingId === player.id ? (
                                    <button onClick={() => handleEditSave(player.id)} className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg">
                                        <Check size={16} />
                                    </button>
                                ) : (
                                    <>
                                        <Link href={`/players/${player.id}`} target="_blank" className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg">
                                            <User size={14} />
                                        </Link>
                                        <button onClick={() => handleEditStart(player)} className="p-2 text-slate-500 hover:text-white hover:bg-card rounded-lg">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => onRemovePlayer(player.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-xl p-6 flex flex-col"
        >
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">Amend Roster</h3>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-card rounded-full">
                    <X size={20} />
                </button>
            </div>

            {view === 'list' ? (
                <div className="flex-1 overflow-y-auto space-y-6 pb-20 custom-scrollbar">
                    <button
                        onClick={() => setView('add')}
                        className="w-full py-4 bg-input border border-border hover:border-orange-500/50 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-all group"
                    >
                        <UserPlus size={20} className="group-hover:text-orange-500 transition-colors" />
                        <span className="font-bold uppercase tracking-widest text-xs">Add New Player</span>
                    </button>

                    {renderRosterList('home', game.homeTeamName)}
                    {renderRosterList('guest', game.guestTeamName)}
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-6">
                    <div className="bg-input/50 p-6 rounded-3xl border border-border space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Team</label>
                            <div className="flex bg-background rounded-xl p-1 border border-border">
                                <button
                                    onClick={() => setNewPlayerTeam('home')}
                                    className={cn(
                                        "flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                        newPlayerTeam === 'home' ? "bg-orange-500 text-white shadow-lg" : "text-slate-500 hover:text-white"
                                    )}
                                >
                                    {game.homeTeamName}
                                </button>
                                <button
                                    onClick={() => setNewPlayerTeam('guest')}
                                    className={cn(
                                        "flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                        newPlayerTeam === 'guest' ? "bg-muted text-white shadow-lg" : "text-slate-500 hover:text-white"
                                    )}
                                >
                                    {game.guestTeamName}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Player Name</label>
                            <input
                                type="text"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                placeholder="e.g. Michael Jordan"
                                className="w-full bg-background border border-border rounded-xl px-4 py-4 text-white focus:outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Jersey Number</label>
                            <input
                                type="text"
                                value={newPlayerNumber}
                                onChange={(e) => setNewPlayerNumber(e.target.value)}
                                placeholder="e.g. 23"
                                className="w-full bg-background border border-border rounded-xl px-4 py-4 text-white font-mono focus:outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="py-4 bg-card text-slate-400 font-bold rounded-2xl hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddSubmit}
                            disabled={!newPlayerName || !newPlayerNumber}
                            className={cn(
                                "py-4 bg-orange-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-600/20 transition-all",
                                (!newPlayerName || !newPlayerNumber) && "opacity-50 grayscale cursor-not-allowed"
                            )}
                        >
                            Add Player
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
