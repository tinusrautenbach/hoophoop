'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

type Member = {
    id: string;
    number: string;
    athlete: {
        name: string;
    };
};

export default function TeamDetailsPage() {
    const params = useParams();
    const teamId = params.id as string;

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamName, setTeamName] = useState('');

    const [playerName, setPlayerName] = useState('');
    const [playerNumber, setPlayerNumber] = useState('');
    const [bulkInput, setBulkInput] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        // In a real app, combine these or use a parallel fetch
        fetch(`/api/teams`)
            .then(res => res.json())
            .then(teams => {
                const team = teams.find((t: any) => t.id === teamId);
                if (team) setTeamName(team.name);
            });

        fetch(`/api/teams/${teamId}/members`)
            .then(res => res.json())
            .then(data => {
                setMembers(data);
                setLoading(false);
            });
    }, [teamId]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName) return;
        setIsAdding(true);

        const res = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({ name: playerName, number: playerNumber }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newMember = await res.json();
            setMembers([...members, newMember]);
            setPlayerName('');
            setPlayerNumber('');
        }
        setIsAdding(false);
    };

    const handleBulkAdd = async () => {
        // For now, let's keep it simple and UI only, or call service.
        // Since we have a service but it's on the server, we could make an API for bulk.
        // Alternatively, just split and call the POST endpoint multiple times (not ideal but quick).
        // Let's implement a quick client-side parser matches our spec.
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
                body: JSON.stringify({ name, number: num }),
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Refresh list
        const res = await fetch(`/api/teams/${teamId}/members`);
        const data = await res.json();
        setMembers(data);

        setBulkInput('');
        setShowBulk(false);
        setIsAdding(false);
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this player from the team?')) return;

        const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
            method: 'DELETE',
        });

        if (res.ok) {
            setMembers(members.filter(m => m.id !== memberId));
        }
    };

    if (loading) return <div className="p-8 text-center">Loading team details...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <Link href="/teams" className="text-sm text-slate-400 hover:text-orange-500 mb-2 inline-block">← Back to Teams</Link>
                <h1 className="text-3xl font-bold">{teamName} Roster</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Left Col: Add Player */}
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
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Player Name</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={e => setPlayerName(e.target.value)}
                                        placeholder="e.g. Michael Jordan"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        required
                                    />
                                </div>
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
                                <button
                                    disabled={isAdding}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Adding...' : 'Add Player'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Right Col: Member List */}
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
                                        <td className="px-6 py-4 font-medium">{member.athlete.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleRemoveMember(member.id)}
                                                className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 italic text-xs"
                                            >
                                                Remove
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
        </div>
    );
}

import Link from 'next/link';
