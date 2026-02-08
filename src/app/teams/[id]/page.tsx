'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, Search, Plus, X, Edit2, Users, Shield, 
    ChevronDown, Check, User, Trash2, Calendar
} from 'lucide-react';

type Member = {
    id: string;
    number: string | null;
    isActive: boolean;
    athlete: {
        id: string;
        name: string;
    };
    team?: {
        id: string;
        name: string;
    };
};

type Community = {
    id: string;
    name: string;
};

type PlayerSearchResult = {
    id: string;
    name: string;
};

export default function TeamDetailsPage() {
    const params = useParams();
    const teamId = params.id as string;

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamName, setTeamName] = useState('');
    const [teamCommunityId, setTeamCommunityId] = useState<string | null>(null);
    const [communities, setCommunities] = useState<Community[]>([]);

    const [playerName, setPlayerName] = useState('');
    const [playerNumber, setPlayerNumber] = useState('');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
    const [showPlayerSearch, setShowPlayerSearch] = useState(false);
    const [bulkInput, setBulkInput] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editNumber, setEditNumber] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);

    useEffect(() => {
        fetch(`/api/teams/${teamId}`)
            .then(res => res.json())
            .then(data => {
                setTeamName(data.name || '');
                setTeamCommunityId(data.communityId || null);
            });

        fetch(`/api/teams/${teamId}/members`)
            .then(res => res.json())
            .then(data => {
                setMembers(data);
                setLoading(false);
            });

        fetch('/api/communities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCommunities(data);
            });
    }, [teamId]);

    useEffect(() => {
        if (playerName.length >= 2 && showPlayerSearch) {
            const timer = setTimeout(() => {
                fetch(`/api/players?q=${encodeURIComponent(playerName)}`)
                    .then(res => res.json())
                    .then(data => setPlayerSearchResults(data));
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setPlayerSearchResults([]);
        }
    }, [playerName, showPlayerSearch]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName && !selectedPlayerId) return;
        setIsAdding(true);

        const res = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({
                athleteId: selectedPlayerId,
                name: selectedPlayerId ? undefined : playerName,
                number: playerNumber,
                communityId: teamCommunityId,
            }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newMember = await res.json();
            setMembers([...members, newMember]);
            setPlayerName('');
            setPlayerNumber('');
            setSelectedPlayerId(null);
        }
        setIsAdding(false);
    };

    const handleBulkAdd = async () => {
        const lines = bulkInput.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
        setIsAdding(true);

        for (const line of lines) {
            const matchNumberFirst = line.match(/^(\d+)\s+(.+)$/);
            const matchNumberLast = line.match(/^(.+)\s+(\d+)$/);

            let name = line;
            let num = "";

            if (matchNumberFirst) {
                num = matchNumberFirst[1];
                name = matchNumberFirst[2];
            } else if (matchNumberLast) {
                name = matchNumberLast[1];
                num = matchNumberLast[2];
            }

            await fetch(`/api/teams/${teamId}/members`, {
                method: 'POST',
                body: JSON.stringify({ name, number: num, communityId: teamCommunityId }),
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const res = await fetch(`/api/teams/${teamId}/members`);
        const data = await res.json();
        setMembers(data);

        setBulkInput('');
        setShowBulk(false);
        setIsAdding(false);
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this player from the team? This will preserve historical records.')) return;

        const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
            method: 'DELETE',
        });

        if (res.ok) {
            setMembers(members.filter(m => m.id !== memberId));
        }
    };

    const handleSaveEdit = async () => {
        if (!editingMember) return;
        setIsSavingEdit(true);

        const res = await fetch(`/api/teams/${teamId}/members/${editingMember.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: editNumber }),
        });

        if (res.ok) {
            setMembers(members.map(m => 
                m.id === editingMember.id ? { ...m, number: editNumber } : m
            ));
            setEditingMember(null);
        }
        setIsSavingEdit(false);
    };

    const handleCommunityChange = async (communityId: string | null) => {
        setTeamCommunityId(communityId);
        setShowCommunityDropdown(false);

        await fetch(`/api/teams/${teamId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ communityId }),
        });
    };

    if (loading) return <div className="p-8 text-center">Loading team details...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <Link href="/teams" className="text-sm text-slate-400 hover:text-orange-500 mb-2 inline-block">← Back to Teams</Link>
                <div className="flex justify-between items-start">
                    <h1 className="text-3xl font-bold">{teamName} Roster</h1>
                    
                    <div className="relative">
                        <button
                            onClick={() => setShowCommunityDropdown(!showCommunityDropdown)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Shield size={16} className={teamCommunityId ? "text-orange-500" : "text-slate-500"} />
                            {teamCommunityId 
                                ? communities.find(c => c.id === teamCommunityId)?.name 
                                : "No Community"}
                            <ChevronDown size={14} className="text-slate-500" />
                        </button>
                        
                        <AnimatePresence>
                            {showCommunityDropdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-50 shadow-xl"
                                >
                                    <button
                                        onClick={() => handleCommunityChange(null)}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        No Community
                                    </button>
                                    {communities.map(community => (
                                        <button
                                            key={community.id}
                                            onClick={() => handleCommunityChange(community.id)}
                                            className="w-full px-4 py-3 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                                            {community.name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-orange-500">Add Player</h2>
                            <button
                                onClick={() => setShowBulk(!showBulk)}
                                className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-white"
                            >
                                {showBulk ? 'Manual' : 'Bulk Paste'}
                            </button>
                        </div>

                        {showBulk ? (
                            <div className="space-y-4">
                                <textarea
                                    value={bulkInput}
                                    onChange={e => setBulkInput(e.target.value)}
                                    placeholder="23 Jordan&#10;33 Pippen&#10;91 Rodman"
                                    rows={8}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                />
                                <button
                                    onClick={handleBulkAdd}
                                    disabled={isAdding || !bulkInput.trim()}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Adding...' : 'Add All'}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleAddMember} className="space-y-4">
                                <div className="relative">
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Search Existing Player</label>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            value={playerName}
                                            onChange={e => {
                                                setPlayerName(e.target.value);
                                                setSelectedPlayerId(null);
                                                setShowPlayerSearch(true);
                                            }}
                                            onFocus={() => setShowPlayerSearch(true)}
                                            placeholder="Search by name..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                    </div>
                                    
                                    <AnimatePresence>
                                        {showPlayerSearch && playerSearchResults.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden z-50 shadow-xl max-h-48 overflow-y-auto"
                                            >
                                                {playerSearchResults.map(player => (
                                                    <button
                                                        key={player.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setPlayerName(player.name);
                                                            setSelectedPlayerId(player.id);
                                                            setShowPlayerSearch(false);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                                                    >
                                                        <User size={14} className="text-slate-500" />
                                                        {player.name}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {selectedPlayerId && (
                                    <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
                                        <Check size={14} />
                                        Existing player selected
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPlayerId(null);
                                                setPlayerName('');
                                            }}
                                            className="ml-auto hover:text-white"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Jersey Number</label>
                                    <input
                                        type="text"
                                        value={playerNumber}
                                        onChange={e => setPlayerNumber(e.target.value)}
                                        placeholder="23"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>

                                {!selectedPlayerId && (
                                    <div className="text-xs text-slate-500 italic">
                                        New player profile will be created
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isAdding || (!playerName && !selectedPlayerId)}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Adding...' : 'Add Player'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    <div className="bg-slate-800/20 rounded-2xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">#</th>
                                    <th className="px-6 py-4 font-semibold">Name</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {members.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-orange-500">{member.number || '--'}</td>
                                        <td className="px-6 py-4 font-medium">
                                            <Link href={`/players/${member.athlete.id}`} className="hover:text-orange-500 flex items-center gap-2">
                                                {member.athlete.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingMember(member);
                                                    setEditNumber(member.number || '');
                                                }}
                                                className="text-slate-600 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit jersey number"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(member.id)}
                                                className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remove from team"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500 italic">No players added to this roster yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {editingMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setEditingMember(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-4">Edit Player</h3>
                            
                            <div className="mb-4">
                                <div className="text-sm text-slate-400 mb-1">Player</div>
                                <div className="font-medium">{editingMember.athlete.name}</div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Jersey Number</label>
                                <input
                                    type="text"
                                    value={editNumber}
                                    onChange={e => setEditNumber(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingMember(null)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
