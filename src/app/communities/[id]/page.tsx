'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Trophy, Settings, Mail, Copy, Check, Shield, Eye, ShieldAlert, Trash2, RotateCcw } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'members' | 'settings' | 'deleted-games'>('overview');
    const [communityTeams, setCommunityTeams] = useState<any[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('scorer');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [deletedGames, setDeletedGames] = useState<any[]>([]);
    const [deletedGamesLoading, setDeletedGamesLoading] = useState(false);

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

    useEffect(() => {
        if (activeTab === 'teams' && communityTeams.length === 0) {
            setTeamsLoading(true);
            fetch(`/api/communities/${id}/teams`)
                .then(res => res.json())
                .then(data => {
                    setCommunityTeams(data.teams || (Array.isArray(data) ? data : []));
                    setTeamsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setTeamsLoading(false);
                });
        }
    }, [activeTab, id, communityTeams.length]);

    useEffect(() => {
        if (activeTab === 'deleted-games') {
            setDeletedGamesLoading(true);
            fetch(`/api/communities/${id}/deleted-games`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setDeletedGames(data);
                    }
                    setDeletedGamesLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch deleted games:', err);
                    setDeletedGamesLoading(false);
                });
        }
    }, [activeTab, id]);

    const handleRestoreGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to restore this game?')) return;
        
        try {
            const res = await fetch(`/api/communities/${id}/deleted-games/${gameId}`, {
                method: 'POST'
            });
            if (res.ok) {
                setDeletedGames(prev => prev.filter(g => g.id !== gameId));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to restore game');
            }
        } catch (err) {
            console.error('Failed to restore game:', err);
            alert('Failed to restore game');
        }
    };

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
    const isScorer = isOwner || isAdmin || currentUserMember?.role === 'scorer';

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <button onClick={() => router.push('/communities')} className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
                <ArrowLeft size={20} />
                Back to Communities
            </button>

            {/* Header */}
            <div className="bg-input border border-border rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
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
            <div className="flex border-b border-border gap-6 overflow-x-auto">
                {['overview', 'teams', 'members', 'settings', ...(isAdmin ? ['deleted-games'] : [])].map((tab) => (
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
                        {tab === 'deleted-games' ? 'Deleted Games' : tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">Recent Games</h3>
                            {community.games && community.games.length > 0 ? (
                                <div className="space-y-3">
                                    {community.games.map((game: any) => {
                                        // Route to scorer interface for live/scheduled games OR if user has scorer rights
                                        // Otherwise route to spectator page for finished games
                                        const shouldGoToScorer = game.status !== 'final' || isScorer;
                                        const gameLink = shouldGoToScorer
                                            ? `/game/${game.id}/scorer` 
                                            : `/game/${game.id}`;
                                        
                                        return (
                                            <Link
                                                key={game.id}
                                                href={gameLink}
                                                className="flex justify-between items-center bg-background p-3 rounded-xl border border-border hover:border-orange-500/50 hover:bg-input transition-all cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm font-bold">
                                                        <span className="text-orange-500">{game.homeTeamName}</span>
                                                        <span className="text-slate-500 mx-2">vs</span>
                                                        <span className="text-white">{game.guestTeamName}</span>
                                                    </div>
                                                    <div className="bg-card px-2 py-1 rounded-lg">
                                                        <span className="text-orange-500 font-bold">{game.homeScore}</span>
                                                        <span className="text-slate-500 mx-1">-</span>
                                                        <span className="text-white font-bold">{game.guestScore}</span>
                                                    </div>
                                                    {game.status === 'live' && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-1 rounded">LIVE</span>
                                                    )}
                                                    {game.status === 'scheduled' && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-1 rounded">UPCOMING</span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-mono text-slate-500">
                                                    {new Date(game.createdAt).toLocaleDateString()}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-slate-500 text-sm italic">No games played yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Teams</h3>
                            <button
                                onClick={() => router.push('/teams')}
                                className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                            >
                                Create New Team
                            </button>
                        </div>

                        {teamsLoading ? (
                            <div className="text-center py-12 text-slate-500">Loading teams...</div>
                        ) : communityTeams.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {communityTeams.map((team) => (
                                    <div 
                                        key={team.id}
                                        onClick={() => router.push(`/teams/${team.id}`)}
                                        className="bg-input border border-border p-6 rounded-2xl cursor-pointer hover:border-orange-500/50 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="text-4xl font-black font-mono text-slate-700 group-hover:text-orange-500 transition-colors">
                                                {team.shortCode || team.name.substring(0, 3).toUpperCase()}
                                            </div>
                                            {team.color && (
                                                <div 
                                                    className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]"
                                                    style={{ backgroundColor: team.color, color: team.color }} 
                                                />
                                            )}
                                        </div>
                                        
                                        <h3 className="text-lg font-bold group-hover:text-white transition-colors truncate">{team.name}</h3>
                                        <div className="text-xs text-slate-500 mt-1">
                                            Created {new Date(team.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-input/50 border border-border border-dashed rounded-2xl p-12 text-center">
                                <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
                                <h3 className="text-lg font-bold text-slate-400 mb-2">No Teams Yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                    Teams created by community members will appear here.
                                </p>
                                <button
                                    onClick={() => router.push('/teams')}
                                    className="bg-card hover:bg-muted text-white font-bold px-6 py-3 rounded-xl transition-colors"
                                >
                                    Create Your First Team
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-8">
                        {/* Invite Section (Admin Only) */}
                        {isAdmin && (
                            <div className="bg-input border border-border rounded-2xl p-6">
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
                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                            required
                                        />
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
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
                                    <div className="bg-background border border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
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
                                                className="flex-1 sm:flex-none bg-card hover:bg-muted text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                                {copied ? 'Copied' : 'Copy'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setInviteLink('');
                                                    setInviteEmail('');
                                                }}
                                                className="flex-1 sm:flex-none bg-card hover:bg-muted text-white px-4 py-2 rounded-lg text-sm font-bold"
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
                                <div key={member.id} className="bg-input border border-border p-4 rounded-xl flex items-center justify-between group hover:border-border transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center",
                                            member.role === 'admin' ? "bg-orange-500/20 text-orange-500" : 
                                            member.role === 'scorer' ? "bg-blue-500/20 text-blue-500" : "bg-card text-slate-500"
                                        )}>
                                            {member.role === 'admin' ? <Shield size={18} /> : 
                                             member.role === 'scorer' ? <ShieldAlert size={18} /> : <Eye size={18} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm truncate max-w-[180px]">{member.displayName}</div>
                                            {member.userEmail && (
                                                <div className="text-xs text-slate-500 truncate max-w-[180px]">{member.userEmail}</div>
                                            )}
                                            <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{member.role}</div>
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

                {activeTab === 'deleted-games' && (
                    <div className="space-y-6">
                        <div className="bg-input/50 border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Trash2 className="text-red-500" size={20} />
                                Deleted Games
                            </h3>
                            
                            {deletedGamesLoading ? (
                                <div className="text-center py-8 text-slate-500">Loading deleted games...</div>
                            ) : deletedGames.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 italic">No deleted games found.</div>
                            ) : (
                                <div className="space-y-3">
                                    {deletedGames.map((game: any) => (
                                        <div key={game.id} className="flex justify-between items-center bg-background p-3 rounded-xl border border-border">
                                            <div>
                                                <div className="font-bold text-sm">
                                                    <span className="text-orange-500">{game.homeTeamName}</span>
                                                    <span className="text-slate-500 mx-2">vs</span>
                                                    <span className="text-white">{game.guestTeamName}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Score: {game.homeScore} - {game.guestScore} | Deleted: {new Date(game.deletedAt).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    by {game.ownerName}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestoreGame(game.id)}
                                                className="bg-green-600/20 hover:bg-green-600/30 text-green-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-colors"
                                            >
                                                <RotateCcw size={12} />
                                                Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
