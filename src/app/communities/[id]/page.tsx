'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Trophy, Settings, Mail, Copy, Check, Shield, Eye, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function CommunityDashboard() {
    const { id } = useParams();
    const router = useRouter();
    const { userId } = useAuth();
    
    const [community, setCommunity] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('scorer');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/communities/${id}`)
            .then(res => res.json())
            .then(data => {
                setCommunity(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                router.push('/communities');
            });
    }, [id, router]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/communities/${id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            
            if (res.ok) {
                const data = await res.json();
                setInviteLink(data.inviteLink);
            }
        } catch (error) {
            console.error('Invite failed:', error);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading community...</div>;
    if (!community) return null;

    const isOwner = community.ownerId === userId;
    const currentUserMember = community.members.find((m: any) => m.userId === userId);
    const isAdmin = isOwner || currentUserMember?.role === 'admin';

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <button onClick={() => router.push('/communities')} className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
                <ArrowLeft size={20} />
                Back to Communities
            </button>

            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-500/10 text-orange-500 px-2 py-1 rounded">
                            {community.type}
                        </span>
                        {isOwner && <span className="text-[10px] font-bold uppercase tracking-widest bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">Owner</span>}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">{community.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                        <div className="flex items-center gap-1">
                            <Users size={16} />
                            <span>{community.members.length} Members</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Trophy size={16} />
                            <span>{community.teams?.length || 0} Teams</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 gap-6 overflow-x-auto">
                {['overview', 'members', 'settings'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                            activeTab === tab
                                ? "text-orange-500 border-b-2 border-orange-500"
                                : "text-slate-500 hover:text-white"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">Recent Games</h3>
                            {community.games && community.games.length > 0 ? (
                                <div className="space-y-3">
                                    {community.games.map((game: any) => (
                                        <div key={game.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                                            <div className="text-sm font-bold">
                                                <span className="text-orange-500">{game.homeTeamName}</span> vs <span className="text-white">{game.guestTeamName}</span>
                                            </div>
                                            <div className="text-xs font-mono text-slate-500">
                                                {new Date(game.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-slate-500 text-sm italic">No games played yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-8">
                        {/* Invite Section (Admin Only) */}
                        {isAdmin && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Mail size={20} className="text-orange-500" />
                                    Invite New Member
                                </h3>
                                
                                {!inviteLink ? (
                                    <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="Enter email address"
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                            required
                                        />
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                        >
                                            <option value="scorer">Scorer</option>
                                            <option value="admin">Admin</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                        <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                                            Generate Link
                                        </button>
                                    </form>
                                ) : (
                                    <div className="bg-slate-950 border border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                                        <div className="flex-1 font-mono text-xs sm:text-sm break-all text-orange-500">
                                            {inviteLink}
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(inviteLink);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                                {copied ? 'Copied' : 'Copy'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setInviteLink('');
                                                    setInviteEmail('');
                                                }}
                                                className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Members List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {community.members.map((member: any) => (
                                <div key={member.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center",
                                            member.role === 'admin' ? "bg-orange-500/20 text-orange-500" : 
                                            member.role === 'scorer' ? "bg-blue-500/20 text-blue-500" : "bg-slate-800 text-slate-500"
                                        )}>
                                            {member.role === 'admin' ? <Shield size={18} /> : 
                                             member.role === 'scorer' ? <ShieldAlert size={18} /> : <Eye size={18} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm truncate max-w-[150px]">{member.userId}</div>
                                            <div className="text-[10px] uppercase font-bold text-slate-500">{member.role}</div>
                                        </div>
                                    </div>
                                    {isAdmin && member.userId !== userId && (
                                        <button className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold uppercase">
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="text-center py-12 text-slate-500 italic">
                        Community settings coming soon...
                    </div>
                )}
            </div>
        </div>
    );
}
