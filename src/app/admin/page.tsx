'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Shield, Search, User, Check, ShieldAlert, ArrowRight, 
    Users, Building2, Trash2, Plus, Minus, ChevronDown, ChevronUp,
    Crown, RotateCcw, Link2, Trophy, X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type UserData = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isWorldAdmin: boolean;
    createdAt: string;
};

type CommunityData = {
    id: string;
    name: string;
    slug: string | null;
    type: 'school' | 'club' | 'league' | 'other';
    ownerId: string;
    owner: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    } | null;
    memberCount: number;
    createdAt: string;
};

type CommunityMember = {
    id: string;
    userId: string;
    role: 'admin' | 'scorer' | 'viewer';
    canManageGames: boolean;
    joinedAt: string;
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
    } | null;
    isOwner: boolean;
};

type DeletedGame = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    status: 'scheduled' | 'live' | 'final';
    createdAt: string;
    deletedAt: string;
    ownerId: string;
    ownerName: string;
    communityId?: string | null;
    community?: {
        id: string;
        name: string;
    } | null;
};

type LinkedAthlete = {
    id: string;
    name: string;
    firstName: string | null;
    surname: string | null;
    status: string;
    communityId: string | null;
    createdAt: string;
    user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        createdAt: string;
    } | null;
};

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'users' | 'communities' | 'deletedGames' | 'linkedAthletes'>('users');
    
    // Users state
    const [users, setUsers] = useState<UserData[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userLoading, setUserLoading] = useState(true);
    
    // Communities state
    const [communities, setCommunities] = useState<CommunityData[]>([]);
    const [communitySearch, setCommunitySearch] = useState('');
    const [communityPage, setCommunityPage] = useState(1);
    const [communityTotalPages, setCommunityTotalPages] = useState(1);
    const [communityLoading, setCommunityLoading] = useState(true);
    
    // Deleted games state
    const [deletedGames, setDeletedGames] = useState<DeletedGame[]>([]);
    const [deletedGamesLoading, setDeletedGamesLoading] = useState(false);

    // Linked athletes state
    const [linkedAthletes, setLinkedAthletes] = useState<LinkedAthlete[]>([]);
    const [linkedAthletesSearch, setLinkedAthletesSearch] = useState('');
    const [linkedAthletesFilter, setLinkedAthletesFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
    const [linkedAthletesPage, setLinkedAthletesPage] = useState(1);
    const [linkedAthletesTotalPages, setLinkedAthletesTotalPages] = useState(1);
    const [linkedAthletesLoading, setLinkedAthletesLoading] = useState(true);
    
    // Community members modal state
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityData | null>(null);
    const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserData[]>([]);
    const [selectedRole, setSelectedRole] = useState<'admin' | 'scorer' | 'viewer'>('scorer');
    
    // Claim requests state
    const [claimRequests, setClaimRequests] = useState<Array<{
        id: string;
        athleteId: string;
        userId: string;
        status: string;
        requestedAt: string;
        athleteName: string;
        userFirstName: string | null;
        userLastName: string | null;
        userEmail: string;
    }>>([]);
    const [claimRequestsLoading, setClaimRequestsLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userPage, userSearch]);

    useEffect(() => {
        fetchCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [communityPage, communitySearch]);

    useEffect(() => {
        if (selectedCommunity) {
            fetchCommunityMembers(selectedCommunity.id);
            fetchClaimRequests(selectedCommunity.id);
        }
    }, [selectedCommunity]);

    useEffect(() => {
        if (activeTab === 'deletedGames') {
            fetchDeletedGames();
        }
    }, [activeTab]);

    useEffect(() => {
        fetchLinkedAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedAthletesPage, linkedAthletesSearch, linkedAthletesFilter]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (userSearchQuery.length >= 2) {
                searchUsers(userSearchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userSearchQuery]);

    const fetchUsers = async () => {
        setUserLoading(true);
        try {
            const params = new URLSearchParams({ page: userPage.toString(), limit: '10' });
            if (userSearch) params.set('search', userSearch);
            
            const res = await fetch(`/api/admin/users?${params.toString()}`);
            if (res.status === 403) {
                setError('Unauthorized');
                return;
            }
            const data = await res.json();
            setUsers(data.users);
            setUserTotalPages(data.pagination.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setUserLoading(false);
        }
    };

    const fetchCommunities = async () => {
        setCommunityLoading(true);
        try {
            const params = new URLSearchParams({ page: communityPage.toString(), limit: '10' });
            if (communitySearch) params.set('search', communitySearch);
            
            const res = await fetch(`/api/admin/communities?${params.toString()}`);
            if (res.status === 403) {
                setError('Unauthorized');
                return;
            }
            const data = await res.json();
            setCommunities(data.communities);
            setCommunityTotalPages(data.pagination.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setCommunityLoading(false);
        }
    };

    const fetchDeletedGames = async () => {
        setDeletedGamesLoading(true);
        try {
            const res = await fetch('/api/games/deleted');
            if (res.ok) {
                const data = await res.json();
                setDeletedGames(data);
            } else if (res.status === 403) {
                setError('Unauthorized');
            }
        } catch (err) {
            console.error('Failed to fetch deleted games:', err);
        } finally {
            setDeletedGamesLoading(false);
        }
    };

    const fetchLinkedAthletes = async () => {
        setLinkedAthletesLoading(true);
        try {
            const params = new URLSearchParams({ 
                page: linkedAthletesPage.toString(), 
                limit: '10' 
            });
            if (linkedAthletesSearch) params.set('search', linkedAthletesSearch);
            if (linkedAthletesFilter !== 'all') params.set('filter', linkedAthletesFilter);
            
            const res = await fetch(`/api/admin/linked-athletes?${params.toString()}`);
            if (res.status === 403) {
                setError('Unauthorized');
                return;
            }
            const data = await res.json();
            setLinkedAthletes(data.linkedAthletes);
            setLinkedAthletesTotalPages(data.pagination.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setLinkedAthletesLoading(false);
        }
    };

    const restoreGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to restore this game?')) return;
        
        try {
            const res = await fetch(`/api/games/deleted/${gameId}`, {
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

    const fetchCommunityMembers = async (communityId: string) => {
        setMembersLoading(true);
        try {
            const res = await fetch(`/api/admin/communities/${communityId}/members`);
            if (res.ok) {
                const data = await res.json();
                setCommunityMembers(data.members);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setMembersLoading(false);
        }
    };

    const fetchClaimRequests = async (communityId: string) => {
        setClaimRequestsLoading(true);
        try {
            const res = await fetch(`/api/admin/communities/${communityId}/claim-requests?status=pending`);
            if (res.ok) {
                const data = await res.json();
                setClaimRequests(data.claims || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setClaimRequestsLoading(false);
        }
    };

    const approveClaimRequest = async (requestId: string) => {
        if (!selectedCommunity) return;
        if (!confirm('Are you sure you want to approve this claim request?')) return;

        try {
            const res = await fetch(`/api/admin/communities/${selectedCommunity.id}/claim-requests/${requestId}`, {
                method: 'POST',
            });
            if (res.ok) {
                setClaimRequests(prev => prev.filter(r => r.id !== requestId));
                alert('Claim request approved!');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to approve claim request');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to approve claim request');
        }
    };

    const rejectClaimRequest = async (requestId: string) => {
        if (!selectedCommunity) return;
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            const res = await fetch(`/api/admin/communities/${selectedCommunity.id}/claim-requests/${requestId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectReason }),
            });
            if (res.ok) {
                setClaimRequests(prev => prev.filter(r => r.id !== requestId));
                setShowRejectModal(null);
                setRejectReason('');
                alert('Claim request rejected');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to reject claim request');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to reject claim request');
        }
    };

    const searchUsers = async (query: string) => {
        try {
            const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.users.filter((u: UserData) => 
                    !communityMembers.some(m => m.userId === u.id)
                ));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleAdmin = async (userId: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} World Admin access?`)) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isWorldAdmin: !currentStatus })
            });

            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, isWorldAdmin: !currentStatus } : u));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update user');
        }
    };

    const deleteUser = async (userId: string, userName: string) => {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone and will remove all their data.`)) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete user');
        }
    };

    const addMemberToCommunity = async (userId: string) => {
        if (!selectedCommunity) return;

        try {
            const res = await fetch(`/api/admin/communities/${selectedCommunity.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    role: selectedRole,
                    canManageGames: selectedRole !== 'viewer'
                })
            });

            if (res.ok) {
                const data = await res.json();
                setCommunityMembers(prev => [...prev, data.member]);
                setShowAddMember(false);
                setUserSearchQuery('');
                setSearchResults([]);
                // Update member count in communities list
                setCommunities(prev => prev.map(c => 
                    c.id === selectedCommunity.id 
                        ? { ...c, memberCount: c.memberCount + 1 }
                        : c
                ));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to add member');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to add member');
        }
    };

    const removeMemberFromCommunity = async (userId: string, userName: string) => {
        if (!selectedCommunity) return;
        if (!confirm(`Remove "${userName}" from ${selectedCommunity.name}?`)) return;

        try {
            const res = await fetch(`/api/admin/communities/${selectedCommunity.id}/members/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setCommunityMembers(prev => prev.filter(m => m.userId !== userId));
                // Update member count in communities list
                setCommunities(prev => prev.map(c => 
                    c.id === selectedCommunity.id 
                        ? { ...c, memberCount: c.memberCount - 1 }
                        : c
                ));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove member');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to remove member');
        }
    };

    const updateMemberRole = async (userId: string, newRole: 'admin' | 'scorer' | 'viewer') => {
        if (!selectedCommunity) return;

        try {
            const res = await fetch(`/api/admin/communities/${selectedCommunity.id}/members/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: newRole,
                    canManageGames: newRole !== 'viewer'
                })
            });

            if (res.ok) {
                setCommunityMembers(prev => prev.map(m => 
                    m.userId === userId 
                        ? { ...m, role: newRole, canManageGames: newRole !== 'viewer' }
                        : m
                ));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update role');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update role');
        }
    };

    if (error === 'Unauthorized') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Access Denied</h1>
                <p className="text-slate-500">You do not have permission to view this area.</p>
                <button onClick={() => router.push('/')} className="mt-6 text-orange-500 hover:text-white font-bold">
                    Return Home
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Shield className="text-orange-500" />
                        World Admin
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">System Management</p>
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => router.push('/admin/players/merge')}
                        className="bg-card hover:bg-muted text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
                    >
                        Merge Players <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveTab('users')}
                    className={cn(
                        "px-6 py-3 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2",
                        activeTab === 'users' 
                            ? "text-orange-500 border-b-2 border-orange-500" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Users size={16} />
                    Users
                </button>
                <button
                    onClick={() => setActiveTab('communities')}
                    className={cn(
                        "px-6 py-3 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2",
                        activeTab === 'communities' 
                            ? "text-orange-500 border-b-2 border-orange-500" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Building2 size={16} />
                    Communities
                </button>
                <button
                    onClick={() => setActiveTab('deletedGames')}
                    className={cn(
                        "px-6 py-3 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2",
                        activeTab === 'deletedGames' 
                            ? "text-orange-500 border-b-2 border-orange-500" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Trash2 size={16} />
                    Deleted Games
                </button>
                <button
                    onClick={() => setActiveTab('linkedAthletes')}
                    className={cn(
                        "px-6 py-3 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2",
                        activeTab === 'linkedAthletes' 
                            ? "text-orange-500 border-b-2 border-orange-500" 
                            : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Link2 size={16} />
                    Linked Athletes
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="bg-input border border-border rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold">User Management</h2>
                        <div className="relative w-full sm:w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={userSearch}
                                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                                className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">User ID</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Joined</th>
                                    <th className="px-6 py-4 text-center">World Admin</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {userLoading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading users...</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No users found.</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-card/30 transition-colors">
                                            <td className="px-6 py-4 font-medium flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-slate-400">
                                                    <User size={14} />
                                                </div>
                                                {user.firstName} {user.lastName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-mono truncate max-w-[150px]" title={user.id}>
                                                {user.id}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm font-mono">{user.email}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                {user.isWorldAdmin ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/20 text-orange-500 text-xs font-bold uppercase">
                                                        <Check size={12} /> Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600 text-xs font-bold uppercase">No</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => toggleAdmin(user.id, user.isWorldAdmin)}
                                                        className={cn(
                                                            "text-xs font-bold uppercase tracking-widest px-3 py-1 rounded transition-colors",
                                                            user.isWorldAdmin 
                                                                ? "bg-card text-slate-400 hover:bg-red-900/30 hover:text-red-400" 
                                                                : "bg-card text-slate-400 hover:bg-orange-500/20 hover:text-orange-500"
                                                        )}
                                                    >
                                                        {user.isWorldAdmin ? 'Revoke Admin' : 'Make Admin'}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(user.id, `${user.firstName} ${user.lastName}`.trim() || user.email)}
                                                        className="p-1.5 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {userTotalPages > 1 && (
                        <div className="p-4 border-t border-border flex justify-center gap-2">
                            <button
                                disabled={userPage === 1}
                                onClick={() => setUserPage(p => p - 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Prev
                            </button>
                            <span className="px-4 py-2 text-sm font-mono text-slate-500">
                                Page {userPage} of {userTotalPages}
                            </span>
                            <button
                                disabled={userPage === userTotalPages}
                                onClick={() => setUserPage(p => p + 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Communities Tab */}
            {activeTab === 'communities' && !selectedCommunity && (
                <div className="bg-input border border-border rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold">Community Management</h2>
                        <div className="relative w-full sm:w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search communities..."
                                value={communitySearch}
                                onChange={(e) => { setCommunitySearch(e.target.value); setCommunityPage(1); }}
                                className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Community</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Owner</th>
                                    <th className="px-6 py-4 text-center">Members</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {communityLoading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading communities...</td></tr>
                                ) : communities.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No communities found.</td></tr>
                                ) : (
                                    communities.map(community => (
                                        <tr key={community.id} className="hover:bg-card/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-slate-400">
                                                        <Building2 size={14} />
                                                    </div>
                                                    {community.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm capitalize">{community.type}</td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {community.owner ? `${community.owner.firstName} ${community.owner.lastName}`.trim() || community.owner.email : 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-card text-slate-400 text-xs font-bold">
                                                    <Users size={12} /> {community.memberCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedCommunity(community)}
                                                    className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-card text-slate-400 hover:bg-orange-500/20 hover:text-orange-500 transition-colors"
                                                >
                                                    Manage Members
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {communityTotalPages > 1 && (
                        <div className="p-4 border-t border-border flex justify-center gap-2">
                            <button
                                disabled={communityPage === 1}
                                onClick={() => setCommunityPage(p => p - 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Prev
                            </button>
                            <span className="px-4 py-2 text-sm font-mono text-slate-500">
                                Page {communityPage} of {communityTotalPages}
                            </span>
                            <button
                                disabled={communityPage === communityTotalPages}
                                onClick={() => setCommunityPage(p => p + 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Community Members Management */}
            {activeTab === 'communities' && selectedCommunity && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                setSelectedCommunity(null);
                                setCommunityMembers([]);
                                setShowAddMember(false);
                            }}
                            className="text-slate-400 hover:text-white font-bold flex items-center gap-1"
                        >
                            <ArrowRight size={16} className="rotate-180" /> Back
                        </button>
                        <h2 className="text-xl font-bold">{selectedCommunity.name} - Members</h2>
                    </div>

                    {/* Add Member Section */}
                    <div className="bg-input border border-border rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold flex items-center gap-2">
                                <Plus size={18} className="text-orange-500" />
                                Add Member to Community
                            </h3>
                            <button
                                onClick={() => setShowAddMember(!showAddMember)}
                                className="text-slate-400 hover:text-white"
                            >
                                {showAddMember ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                        </div>
                        
                        {showAddMember && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search users by name or email..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="bg-background border border-border rounded-lg overflow-hidden">
                                        {searchResults.map(user => (
                                            <div 
                                                key={user.id}
                                                className="p-3 flex items-center justify-between hover:bg-card/50 border-b border-border last:border-b-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-slate-400">
                                                        <User size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={selectedRole}
                                                        onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'scorer' | 'viewer')}
                                                        className="bg-card border border-border rounded px-2 py-1 text-xs"
                                                    >
                                                        <option value="admin">Admin</option>
                                                        <option value="scorer">Scorer</option>
                                                        <option value="viewer">Viewer</option>
                                                    </select>
                                                    <button
                                                        onClick={() => addMemberToCommunity(user.id)}
                                                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded transition-colors"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {userSearchQuery.length >= 2 && searchResults.length === 0 && (
                                    <p className="text-slate-500 text-sm">No users found matching your search.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Members List */}
                    <div className="bg-input border border-border rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h3 className="font-bold flex items-center gap-2">
                                <Users size={18} className="text-orange-500" />
                                Current Members ({communityMembers.length})
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-background text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Joined</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {membersLoading ? (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Loading members...</td></tr>
                                    ) : communityMembers.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">No members yet.</td></tr>
                                    ) : (
                                        communityMembers.map(member => (
                                            <tr key={member.id} className="hover:bg-card/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-slate-400">
                                                            <User size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm flex items-center gap-2">
                                                                {member.user?.firstName} {member.user?.lastName}
                                                                {member.isOwner && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500 text-xs">
                                                                        <Crown size={10} /> Owner
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{member.user?.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {member.isOwner ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/20 text-orange-500 text-xs font-bold uppercase">
                                                            <Crown size={12} /> Owner
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => updateMemberRole(member.userId, e.target.value as 'admin' | 'scorer' | 'viewer')}
                                                            className="bg-card border border-border rounded px-2 py-1 text-xs"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="scorer">Scorer</option>
                                                            <option value="viewer">Viewer</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-sm">
                                                    {new Date(member.joinedAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!member.isOwner && (
                                                        <button
                                                            onClick={() => removeMemberFromCommunity(
                                                                member.userId, 
                                                                `${member.user?.firstName} ${member.user?.lastName}`.trim() || member.user?.email || 'User'
                                                            )}
                                                            className="p-1.5 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
                                                            title="Remove from Community"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pending Claim Requests Section */}
                    <div className="bg-input border border-border rounded-2xl overflow-hidden mt-6">
                        <div className="p-6 border-b border-border">
                            <h3 className="font-bold flex items-center gap-2">
                                <Trophy size={18} className="text-yellow-500" />
                                Pending Claim Requests ({claimRequests.length})
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">User requests to claim player profiles</p>
                        </div>

                        {claimRequestsLoading ? (
                            <div className="p-12 text-center text-slate-500">Loading...</div>
                        ) : claimRequests.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">No pending claim requests</div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {claimRequests.map((request) => (
                                    <div key={request.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                                                <Trophy className="w-5 h-5 text-yellow-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{request.athleteName}</div>
                                                <div className="text-xs text-slate-400">
                                                    Requested by: {request.userFirstName} {request.userLastName} ({request.userEmail})
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    {new Date(request.requestedAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approveClaimRequest(request.id)}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(request.id)}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
                                <h3 className="font-bold text-lg mb-4">Reject Claim Request</h3>
                                <p className="text-slate-400 text-sm mb-4">Please provide a reason for rejecting this claim request:</p>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Reason for rejection..."
                                    className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-orange-500 mb-4"
                                    rows={3}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-bold rounded transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => rejectClaimRequest(showRejectModal)}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Deleted Games Tab */}
            {activeTab === 'deletedGames' && (
                <div className="bg-input border border-border rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Trash2 className="text-red-500" />
                            Deleted Games
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Games that have been soft-deleted and can be restored</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Game</th>
                                    <th className="px-6 py-4">Community</th>
                                    <th className="px-6 py-4">Owner</th>
                                    <th className="px-6 py-4">Deleted</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {deletedGamesLoading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading deleted games...</td></tr>
                                ) : deletedGames.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No deleted games found.</td></tr>
                                ) : (
                                    deletedGames.map(game => (
                                        <tr key={game.id} className="hover:bg-card/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium">
                                                    <span className="text-orange-500">{game.homeTeamName}</span>
                                                    <span className="text-slate-500 mx-2">vs</span>
                                                    <span className="text-white">{game.guestTeamName}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Score: {game.homeScore} - {game.guestScore} | Status: {game.status}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {game.community?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {game.ownerName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {new Date(game.deletedAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => restoreGame(game.id)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600/20 text-green-500 text-xs font-bold uppercase hover:bg-green-600/30 transition-colors"
                                                >
                                                    <RotateCcw size={14} />
                                                    Restore
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Linked Athletes Tab */}
            {activeTab === 'linkedAthletes' && (
                <div className="bg-input border border-border rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Link2 size={20} className="text-orange-500" />
                            User-Athlete Links
                        </h2>
                        <div className="flex gap-2">
                            <select
                                value={linkedAthletesFilter}
                                onChange={(e) => { setLinkedAthletesFilter(e.target.value as 'all' | 'linked' | 'unlinked'); setLinkedAthletesPage(1); }}
                                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                            >
                                <option value="all">All Players</option>
                                <option value="linked">Linked</option>
                                <option value="unlinked">Unlinked</option>
                            </select>
                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search players or users..."
                                    value={linkedAthletesSearch}
                                    onChange={(e) => { setLinkedAthletesSearch(e.target.value); setLinkedAthletesPage(1); }}
                                    className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Athlete</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Linked User</th>
                                    <th className="px-6 py-4">User Email</th>
                                    <th className="px-6 py-4">Linked At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {linkedAthletesLoading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading...</td></tr>
                                ) : linkedAthletes.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No athletes found.</td></tr>
                                ) : (
                                    linkedAthletes.map(athlete => (
                                        <tr key={athlete.id} className="hover:bg-card/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                                                        <Trophy size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{athlete.name}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {athlete.firstName} {athlete.surname}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase",
                                                    athlete.status === 'active' 
                                                        ? "bg-green-500/20 text-green-500"
                                                        : "bg-slate-500/20 text-slate-500"
                                                )}>
                                                    {athlete.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {athlete.user ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-card flex items-center justify-center text-slate-400">
                                                            <User size={12} />
                                                        </div>
                                                        <span className="text-sm">
                                                            {athlete.user.firstName} {athlete.user.lastName}
                                                        </span>
                                                        {athlete.user.id && (
                                                            <span className="text-[10px] text-slate-500 font-mono ml-1">
                                                                ({athlete.user.id.substring(0, 8)}...)
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-sm italic">Not linked</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {athlete.user?.email || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {athlete.user?.createdAt 
                                                    ? new Date(athlete.user.createdAt).toLocaleDateString()
                                                    : '-'
                                                }
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {linkedAthletesTotalPages > 1 && (
                        <div className="p-4 border-t border-border flex justify-center gap-2">
                            <button
                                disabled={linkedAthletesPage === 1}
                                onClick={() => setLinkedAthletesPage(p => p - 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Prev
                            </button>
                            <span className="px-4 py-2 text-sm font-mono text-slate-500">
                                Page {linkedAthletesPage} of {linkedAthletesTotalPages}
                            </span>
                            <button
                                disabled={linkedAthletesPage === linkedAthletesTotalPages}
                                onClick={() => setLinkedAthletesPage(p => p + 1)}
                                className="px-4 py-2 rounded bg-card text-sm font-bold disabled:opacity-50 hover:bg-muted"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
