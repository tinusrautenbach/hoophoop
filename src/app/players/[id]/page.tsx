'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Edit2, History, User, Shield } from 'lucide-react';

type Player = {
    id: string;
    name: string;
    email: string | null;
    birthDate: string | null;
    status: string;
    createdAt: string;
};

type TeamMembership = {
    id: string;
    number: string | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    team: {
        id: string;
        name: string;
        shortCode: string | null;
    };
};

type HistoryEntry = {
    id: string;
    action: string;
    previousValue: string | null;
    newValue: string | null;
    performedBy: string | null;
    notes: string | null;
    createdAt: string;
    team: {
        id: string;
        name: string;
    } | null;
};

export default function PlayerProfilePage() {
    const params = useParams();
    const router = useRouter();
    const playerId = params.id as string;

    const [player, setPlayer] = useState<Player | null>(null);
    const [memberships, setMemberships] = useState<TeamMembership[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', birthDate: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch(`/api/players/${playerId}`)
            .then(res => {
                if (!res.ok) throw new Error('Player not found');
                return res.json();
            })
            .then(data => {
                setPlayer(data);
                setMemberships(data.memberships || []);
                setHistory(data.history || []);
                setEditForm({
                    name: data.name || '',
                    email: data.email || '',
                    birthDate: data.birthDate || '',
                });
                setLoading(false);
            })
            .catch(() => {
                router.push('/teams');
            });
    }, [playerId, router]);

    const handleSave = async () => {
        setIsSaving(true);
        const res = await fetch(`/api/players/${playerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editForm.name,
                email: editForm.email || null,
                birthDate: editForm.birthDate || null,
            }),
        });

        if (res.ok) {
            const updated = await res.json();
            setPlayer(updated);
            setIsEditing(false);
        }
        setIsSaving(false);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading player profile...</div>;

    if (!player) return null;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <Link href="/teams" className="text-sm text-slate-400 hover:text-orange-500 mb-4 inline-block">
                ← Back to Teams
            </Link>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Player Info Card */}
                <div className="md:col-span-1">
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <User size={40} className="text-orange-500" />
                        </div>

                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Birth Date</label>
                                    <input
                                        type="date"
                                        value={editForm.birthDate}
                                        onChange={e => setEditForm({ ...editForm, birthDate: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditForm({ name: player.name, email: player.email || '', birthDate: player.birthDate || '' });
                                        }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-xl font-bold text-center mb-2">{player.name}</h1>
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4">
                                    <span className={`px-2 py-0.5 rounded text-xs ${player.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                        {player.status}
                                    </span>
                                </div>

                                {player.email && (
                                    <div className="text-sm text-slate-400 text-center mb-2">{player.email}</div>
                                )}
                                {player.birthDate && (
                                    <div className="text-sm text-slate-400 text-center mb-4">Born: {formatDate(player.birthDate)}</div>
                                )}

                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Edit2 size={14} /> Edit Profile
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Team History */}
                <div className="md:col-span-2 space-y-6">
                    {/* Current Teams */}
                    <div className="bg-slate-800/30 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <Shield size={18} className="text-orange-500" />
                            <h2 className="font-semibold">Team Memberships</h2>
                        </div>
                        <table className="w-full">
                            <thead className="bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Team</th>
                                    <th className="px-6 py-3 font-semibold">Jersey</th>
                                    <th className="px-6 py-3 font-semibold">Period</th>
                                    <th className="px-6 py-3 font-semibold text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {memberships.map(membership => (
                                    <tr key={membership.id} className="hover:bg-slate-800/30">
                                        <td className="px-6 py-4">
                                            <Link href={`/teams/${membership.team.id}`} className="font-medium hover:text-orange-500">
                                                {membership.team.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-orange-500">{membership.number || '--'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            {formatDate(membership.startDate)}
                                            {membership.endDate && ` - ${formatDate(membership.endDate)}`}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-xs px-2 py-0.5 rounded ${membership.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                                {membership.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {memberships.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                                            No team memberships yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Activity History */}
                    <div className="bg-slate-800/30 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <History size={18} className="text-orange-500" />
                            <h2 className="font-semibold">Activity History</h2>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {history.map(entry => (
                                <div key={entry.id} className="px-6 py-4 hover:bg-slate-800/30">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium capitalize">
                                                {entry.action.replace('_', ' ')}
                                                {entry.team && <span className="text-slate-400"> - {entry.team.name}</span>}
                                            </div>
                                            {entry.notes && <div className="text-sm text-slate-400 mt-1">{entry.notes}</div>}
                                            {entry.previousValue && entry.newValue && (
                                                <div className="text-sm text-slate-500 mt-1">
                                                    #{entry.previousValue} → #{entry.newValue}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right text-sm text-slate-500">
                                            <div>{formatDate(entry.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && (
                                <div className="px-6 py-8 text-center text-slate-500 italic">
                                    No activity history recorded.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
