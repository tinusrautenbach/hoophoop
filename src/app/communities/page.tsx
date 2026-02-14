'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, School, Trophy } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

type Community = {
    id: string;
    name: string;
    type: string;
    ownerId: string;
    members: any[];
};

export default function CommunitiesPage() {
    const { userId } = useAuth();
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetch('/api/communities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCommunities(data);
                }
                setLoading(false);
            });
    }, [userId]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading communities...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight">Communities</h1>
                    <p className="text-slate-500 text-sm">Schools, Clubs, and Leagues you belong to.</p>
                </div>
                <Link href="/communities/create">
                    <button className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
                        <Plus size={18} />
                        New
                    </button>
                </Link>
            </div>

            {communities.length === 0 ? (
                <div className="text-center py-12 bg-input/50 rounded-3xl border border-white/5">
                    <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
                        <School size={32} className="text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Communities Yet</h3>
                    <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                        Join an existing community via invite link, or create a new one to manage your school or club.
                    </p>
                    <Link href="/communities/create">
                        <button className="text-orange-500 font-bold hover:text-orange-400">
                            Create a Community &rarr;
                        </button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {communities.map((community) => (
                        <Link key={community.id} href={`/communities/${community.id}`}>
                            <div className="bg-input border border-border hover:border-orange-500/50 p-6 rounded-2xl transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                                        <Trophy size={24} className="text-orange-500" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-card text-slate-400 px-2 py-1 rounded">
                                        {community.type}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-1">{community.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Users size={14} />
                                    <span>{community.members?.length || 0} Members</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
