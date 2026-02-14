'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, School, Trophy, Users, Globe } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const TYPES = [
    { id: 'school', label: 'School', icon: School, desc: 'High School, College, or University' },
    { id: 'club', label: 'Club', icon: Trophy, desc: 'Amateur or Professional Club' },
    { id: 'league', label: 'League', icon: Users, desc: 'Tournament or Season League' },
    { id: 'other', label: 'Other', icon: Globe, desc: 'Pickup group or other organization' },
];

export default function CreateCommunityPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [type, setType] = useState('school');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/communities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type }),
            });

            if (res.ok) {
                const community = await res.json();
                router.push(`/communities/${community.id}`);
            } else {
                console.error('Failed to create community');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6">
            <button onClick={() => router.back()} className="mb-6 text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
                <ArrowLeft size={20} />
                Back
            </button>

            <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Create Community</h1>
            <p className="text-slate-500 mb-8">Set up a space for your organization to manage teams, games, and scorers.</p>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Community Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Lincoln High School"
                        className="w-full bg-input border border-border rounded-2xl px-6 py-4 text-lg font-bold focus:outline-none focus:border-orange-500 transition-colors placeholder:text-slate-700"
                        required
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Organization Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {TYPES.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setType(t.id)}
                                className={cn(
                                    "p-4 rounded-xl border text-left transition-all flex items-start gap-3",
                                    type === t.id
                                        ? "bg-orange-500/10 border-orange-500"
                                        : "bg-input border-border hover:border-border"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    type === t.id ? "bg-orange-500 text-white" : "bg-card text-slate-500"
                                )}>
                                    <t.icon size={20} />
                                </div>
                                <div>
                                    <div className={cn("font-bold text-sm", type === t.id ? "text-orange-500" : "text-white")}>
                                        {t.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{t.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !name}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                >
                    {loading ? 'Creating...' : 'Create Community'}
                </button>
            </form>
        </div>
    );
}
