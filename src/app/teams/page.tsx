'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Team = {
    id: string;
    name: string;
    shortCode: string | null;
    color: string | null;
};

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [shortCode, setShortCode] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetch('/api/teams')
            .then(res => res.json())
            .then(data => {
                setTeams(data);
                setLoading(false);
            });
    }, []);

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        const res = await fetch('/api/teams', {
            method: 'POST',
            body: JSON.stringify({ name, shortCode }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newTeam = await res.json();
            setTeams([newTeam, ...teams]);
            setName('');
            setShortCode('');
        }
        setIsCreating(false);
    };

    if (loading) return <div className="p-8 text-center">Loading teams...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">My Teams</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Create Team Card */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4 text-orange-500">New Team</h2>
                    <form onSubmit={handleCreateTeam} className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Team Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Bulls"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Short Code</label>
                            <input
                                type="text"
                                value={shortCode}
                                onChange={e => setShortCode(e.target.value)}
                                placeholder="e.g. CHI"
                                maxLength={3}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        <button
                            disabled={isCreating}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                            {isCreating ? 'Creating...' : 'Create Team'}
                        </button>
                    </form>
                </div>

                {/* Teams List */}
                {teams.map(team => (
                    <Link key={team.id} href={`/teams/${team.id}`} className="group">
                        <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700 hover:border-orange-500 transition-all hover:scale-[1.02] h-full flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-2xl font-bold mb-3 group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-colors">
                                {team.shortCode || team.name.slice(0, 3).toUpperCase()}
                            </div>
                            <h3 className="font-semibold text-lg">{team.name}</h3>
                            <p className="text-slate-500 text-xs mt-1">Manage Roster →</p>
                        </div>
                    </Link>
                ))}

                {teams.length === 0 && !loading && (
                    <div className="col-span-2 flex items-center justify-center text-slate-500 italic">
                        No teams created yet. Start by creating your first team.
                    </div>
                )}
            </div>
        </div>
    );
}
