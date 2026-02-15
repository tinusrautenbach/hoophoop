'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, SignOutButton } from '@/components/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { User, Mail, Shield, History, LogOut, ArrowRight, Trophy, School, Globe, Palette, Send, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ProfileData = {
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        isWorldAdmin: boolean;
        theme: 'light' | 'dark';
    };
    playerProfile: {
        id: string;
        name: string;
        community: { name: string } | null;
    } | null;
    communities: Array<{
        id: string;
        name: string;
        type: string;
        role: string;
    }>;
    activity: Array<{
        id: string;
        action: string;
        resourceType: string;
        resourceId: string;
        createdAt: string;
    }>;
    pendingInvitations?: Array<{
        id: string;
        token: string;
        email: string;
        status: string;
        expiresAt: string;
        athlete: {
            id: string;
            name: string;
        } | null;
    }>;
    pendingClaimRequests?: Array<{
        id: string;
        athleteId: string;
        status: string;
        requestedAt: string;
        athlete: {
            id: string;
            name: string;
            firstName: string | null;
            surname: string | null;
        } | null;
        community: {
            id: string;
            name: string;
        } | null;
    }>;
};

export default function ProfilePage() {
    const { userId, isLoaded } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingInvitations, setPendingInvitations] = useState<ProfileData['pendingInvitations']>([]);
    const [pendingClaimRequests, setPendingClaimRequests] = useState<ProfileData['pendingClaimRequests']>([]);
    const [managingInvitations, setManagingInvitations] = useState(false);

    useEffect(() => {
        if (userId) {
            // Fetch pending invitations
            fetch('/api/players/invitations')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setPendingInvitations(data);
                    }
                })
                .catch(err => console.error('Failed to load invitations:', err));
        }
    }, [userId]);

    useEffect(() => {
        if (isLoaded && !userId) {
            router.push('/');
            return;
        }

        if (userId) {
            fetch('/api/profile')
                .then(res => res.json())
                .then(data => {
                    setData(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load profile:', err);
                    setLoading(false);
                });
        }
    }, [userId, isLoaded, router]);

    const handleResendInvitation = async (token: string) => {
        setManagingInvitations(true);
        try {
            const res = await fetch(`/api/players/invitations/${token}/resend`, {
                method: 'POST',
            });
            if (res.ok) {
                // Refresh invitations
                const invitationsRes = await fetch('/api/players/invitations');
                const data = await invitationsRes.json();
                if (Array.isArray(data)) {
                    setPendingInvitations(data);
                }
            } else {
                alert('Failed to resend invitation');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to resend invitation');
        } finally {
            setManagingInvitations(false);
        }
    };

    const handleCancelInvitation = async (token: string) => {
        if (!confirm('Are you sure you want to cancel this invitation?')) return;
        
        setManagingInvitations(true);
        try {
            const res = await fetch(`/api/players/invitations/${token}/resend`, {
                method: 'DELETE',
            });
            if (res.ok) {
                // Remove from list
                setPendingInvitations(prev => prev?.filter(inv => inv.token !== token) || []);
            } else {
                alert('Failed to cancel invitation');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to cancel invitation');
        } finally {
            setManagingInvitations(false);
        }
    };

    const handleUnlinkProfile = async (playerId: string) => {
        if (!confirm('Are you sure you want to unlink this athlete profile? This means the profile will no longer be associated with your account. You can claim it again later if needed.')) return;
        
        try {
            const res = await fetch(`/api/players/${playerId}/unlink`, {
                method: 'POST',
            });
            if (res.ok) {
                // Refresh profile data
                const profileRes = await fetch('/api/profile');
                const profileData = await profileRes.json();
                setData(prev => prev ? { ...prev, playerProfile: null } : null);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to unlink profile');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to unlink profile');
        }
    };

    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header / User Info */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    
                    <div className="relative">
                        {data.user.imageUrl ? (
                            <img src={data.user.imageUrl} alt="Profile" className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-orange-500/20 shadow-xl" />
                        ) : (
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-[var(--muted)] flex items-center justify-center text-4xl font-black text-[var(--muted-foreground)] ring-4 ring-white/5 shadow-xl">
                                {data.user.firstName?.[0] || 'U'}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-orange-600 p-2 rounded-xl shadow-lg text-white">
                            <User size={16} />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[var(--foreground)]">
                            {data.user.firstName} {data.user.lastName}
                        </h1>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            {data.user.isWorldAdmin && (
                                <Link 
                                    href="/admin"
                                    className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-900/50 hover:shadow-orange-500/30 transition-all"
                                >
                                    <Shield size={12} /> World Admin
                                </Link>
                            )}
                            <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-sm font-bold">
                                <Mail size={16} className="text-orange-500/60" />
                                {data.user.email}
                            </div>
                            <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-sm font-bold">
                                <Shield size={16} className="text-orange-500/60" />
                                ID: {data.user.id.substring(0, 12)}...
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-3">
                        <ThemeToggle variant="outline" className="w-full md:w-auto justify-center" />
                        <SignOutButton>
                            <button className="w-full md:w-auto bg-[var(--muted)] hover:bg-red-950/30 hover:text-red-500 border border-[var(--border)] hover:border-red-500/30 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 group text-[var(--foreground)]">
                                <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                                Logout
                            </button>
                        </SignOutButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Athlete Profile */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] px-2 flex items-center gap-2">
                            <Trophy size={16} className="text-orange-500" />
                            Athlete Profile
                        </h2>
                        {data.playerProfile ? (
                            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl hover:border-orange-500/50 transition-all group shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Trophy size={64} />
                                </div>
                                <div className="flex items-center gap-6">
                                    <Link href={`/players/${data.playerProfile.id}`}>
                                        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform font-black text-2xl cursor-pointer">
                                            {data.playerProfile.name.charAt(0)}
                                        </div>
                                    </Link>
                                    <div className="flex-1">
                                        <Link href={`/players/${data.playerProfile.id}`}>
                                            <div className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] hover:text-orange-500 transition-colors">
                                                {data.playerProfile.name}
                                            </div>
                                        </Link>
                                        {data.playerProfile.community && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-foreground)] mt-1">
                                                <Shield size={12} className="text-blue-500" />
                                                {data.playerProfile.community.name}
                                            </div>
                                        )}
                                        <div className="mt-4 flex items-center gap-3">
                                            <Link href={`/players/${data.playerProfile.id}`}>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                                                    View Statistics <ArrowRight size={12} />
                                                </span>
                                            </Link>
                                            <button
                                                onClick={() => handleUnlinkProfile(data.playerProfile!.id)}
                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70 hover:text-red-500 flex items-center gap-2 transition-colors"
                                            >
                                                Unlink Profile <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[var(--card)]/50 border border-dashed border-[var(--border)] p-8 rounded-3xl text-center space-y-4">
                                <p className="text-[var(--muted-foreground)] text-sm">No athlete profile linked to your account.</p>
                                <div className="flex flex-col gap-2">
                                    <Link href="/players">
                                        <button className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all">
                                            Find & Claim Profile
                                        </button>
                                    </Link>
                                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase font-bold">
                                        OR ask your community admin to invite you
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pending Invitations */}
                    {pendingInvitations && pendingInvitations.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] px-2 flex items-center gap-2">
                                <Send size={16} className="text-orange-500" />
                                Pending Invitations ({pendingInvitations.length})
                            </h2>
                            <div className="space-y-3">
                                {pendingInvitations.map((invitation) => (
                                    <div key={invitation.id} className="bg-[var(--card)] border border-[var(--border)] p-4 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                                                <User className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{invitation.athlete?.name || 'Unknown Player'}</div>
                                                <div className="text-xs text-[var(--muted-foreground)]">{invitation.email}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleResendInvitation(invitation.token)}
                                                disabled={managingInvitations}
                                                className="p-2 bg-[var(--muted)] hover:bg-[var(--border)] rounded-lg transition-colors"
                                                title="Resend invitation"
                                            >
                                                <RefreshCw size={16} className={managingInvitations ? 'animate-spin' : ''} />
                                            </button>
                                            <button
                                                onClick={() => handleCancelInvitation(invitation.token)}
                                                disabled={managingInvitations}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                                title="Cancel invitation"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Claim Requests */}
                    {pendingClaimRequests && pendingClaimRequests.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] px-2 flex items-center gap-2">
                                <Trophy size={16} className="text-orange-500" />
                                Pending Claim Requests ({pendingClaimRequests.length})
                            </h2>
                            <div className="space-y-3">
                                {pendingClaimRequests.map((request) => (
                                    <div key={request.id} className="bg-[var(--card)] border border-[var(--border)] p-4 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                                                <Trophy className="w-5 h-5 text-yellow-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{request.athlete?.name || 'Unknown Player'}</div>
                                                <div className="text-xs text-[var(--muted-foreground)]">
                                                    {request.community?.name || 'No Community'}
                                                </div>
                                                <div className="text-[10px] text-yellow-500 mt-0.5">
                                                    Pending approval from admin
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-[var(--muted-foreground)]">
                                            Requested: {new Date(request.requestedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Communities */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] px-2 flex items-center gap-2">
                            <School size={16} className="text-blue-500" />
                            My Communities
                        </h2>
                        <div className="space-y-3">
                            {data.communities.length > 0 ? (
                                data.communities.map((community) => (
                                    <Link key={community.id} href={`/communities/${community.id}`}>
                                        <div className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl hover:border-orange-500/50 transition-all group cursor-pointer flex items-center justify-between shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-[var(--muted)] rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                                                    {community.type === 'school' ? <School size={20} /> : <Globe size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm uppercase tracking-tight text-[var(--foreground)]">{community.name}</div>
                                                    <div className="text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest mt-0.5">{community.role}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} className="text-[var(--border)] group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="bg-[var(--card)]/50 border border-dashed border-[var(--border)] p-10 rounded-3xl text-center space-y-4">
                                    <p className="text-[var(--muted-foreground)] text-sm italic">No communities joined yet.</p>
                                    <Link href="/communities/create">
                                        <button className="text-orange-500 font-black uppercase tracking-widest text-xs hover:text-orange-400">
                                            Create One &rarr;
                                        </button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] px-2 flex items-center gap-2">
                            <History size={16} className="text-blue-500" />
                            Recent Activity
                        </h2>
                        <div className="bg-[var(--card)]/40 border border-[var(--border)] rounded-[32px] overflow-hidden">
                            <div className="divide-y divide-[var(--border)]">
                                {data.activity.length > 0 ? (
                                    data.activity.map((item) => (
                                        <div key={item.id} className="p-4 flex items-start gap-4">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-[var(--foreground)]">
                                                    <span className="text-blue-400 uppercase tracking-widest text-[10px]">{item.action.replace(/_/g, ' ')}</span>
                                                    <span className="text-[var(--muted-foreground)] mx-2">•</span>
                                                    {item.resourceType} {item.resourceId.substring(0, 8)}
                                                </p>
                                                <p className="text-[10px] text-[var(--muted-foreground)] font-mono mt-1">
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-[var(--muted-foreground)] text-sm italic">
                                        No recent activity recorded.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Appearance Settings */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 sm:p-8 shadow-2xl">
                    <h2 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)] mb-6 flex items-center gap-3">
                        <Palette size={24} className="text-orange-500" />
                        Appearance
                    </h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-[var(--foreground)]">Theme</h3>
                            <p className="text-sm text-[var(--muted-foreground)]">Choose between light and dark mode</p>
                        </div>
                        <ThemeToggle variant="default" />
                    </div>
                </div>
            </div>
        </div>
    );
}
