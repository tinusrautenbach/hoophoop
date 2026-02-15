'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, Search, Plus, X, Edit2, Users, Shield, 
    ChevronDown, Check, User, Trash2, Calendar, UserPlus, Globe, Trophy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Member = {
    id: string;
    number: string | null;
    isActive: boolean;
    athlete: {
        id: string;
        name: string;
        firstName: string | null;
        surname: string | null;
        birthDate: string | null;
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

type TeamSeason = {
    id: string;
    status: string;
    season: {
        id: string;
        name: string;
        startDate: string | null;
        endDate: string | null;
    };
};

type PlayerSearchResult = {
    id: string;
    name: string;
    firstName: string | null;
    surname: string | null;
    birthDate: string | null;
    isWorldAvailable: boolean;
    community: { id: string; name: string } | null;
    memberships: {
        id: string;
        number: string | null;
        isActive: boolean;
        team: { id: string; name: string; communityId: string | null };
    }[];
};

export default function TeamDetailsPage() {
    const params = useParams();
    const teamId = params.id as string;

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamName, setTeamName] = useState('');
    const [teamShortCode, setTeamShortCode] = useState('');
    const [teamColor, setTeamColor] = useState('');
    const [teamCommunityId, setTeamCommunityId] = useState<string | null>(null);
    const [teamGames, setTeamGames] = useState<any[]>([]);
    const [teamSeasons, setTeamSeasons] = useState<TeamSeason[]>([]);
    const [communities, setCommunities] = useState<Community[]>([]);

    // Search existing player state
    const [searchQuery, setSearchQuery] = useState('');
    const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
    const [showPlayerSearch, setShowPlayerSearch] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
    const [searchJerseyNumber, setSearchJerseyNumber] = useState('');

    // Add new player state
    const [showNewPlayer, setShowNewPlayer] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newSurname, setNewSurname] = useState('');
    const [newBirthDate, setNewBirthDate] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newJerseyNumber, setNewJerseyNumber] = useState('');

    // Bulk add state
    const [bulkInput, setBulkInput] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Edit modal state
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editNumber, setEditNumber] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    
    // Team Edit State
    const [isEditingTeam, setIsEditingTeam] = useState(false);
    const [editTeamName, setEditTeamName] = useState('');
    const [editTeamShortCode, setEditTeamShortCode] = useState('');
    const [editTeamColor, setEditTeamColor] = useState('');
    const [isSavingTeam, setIsSavingTeam] = useState(false);

    // Community dropdown state
    const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);

    // Active tab for add player section
    const [activeTab, setActiveTab] = useState<'search' | 'new' | 'bulk'>('search');

    useEffect(() => {
        fetch(`/api/teams/${teamId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error('Error fetching team:', data.error);
                    setTeamName('');
                    setTeamCommunityId(null);
                    setTeamGames([]);
                } else {
                    setTeamName(data.name || '');
                    setTeamShortCode(data.shortCode || '');
                    setTeamColor(data.color || '');
                    setTeamCommunityId(data.communityId || null);
                    const allGames = [...(data.homeGames || []), ...(data.guestGames || [])]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setTeamGames(allGames);
                    setTeamSeasons(data.teamSeasons || []);
                }
            })
            .catch(err => {
                console.error('Failed to fetch team:', err);
                setTeamName('');
                setTeamCommunityId(null);
                setTeamGames([]);
            });

        fetch(`/api/teams/${teamId}/members`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setMembers(data);
                } else if (data.error) {
                    console.error('Error fetching members:', data.error);
                    setMembers([]);
                } else {
                    setMembers([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch members:', err);
                setMembers([]);
                setLoading(false);
            });

        fetch('/api/communities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCommunities(data);
            })
            .catch(err => {
                console.error('Failed to fetch communities:', err);
            });
    }, [teamId]);

    // Debounced player search scoped to community
    useEffect(() => {
        if (searchQuery.length >= 2 && showPlayerSearch) {
            const timer = setTimeout(() => {
                const params = new URLSearchParams({ q: searchQuery });
                if (teamCommunityId) params.set('communityId', teamCommunityId);
                fetch(`/api/players?${params.toString()}`)
                    .then(res => res.json())
                    .then(data => setPlayerSearchResults(data));
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setPlayerSearchResults([]);
        }
    }, [searchQuery, showPlayerSearch, teamCommunityId]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    };

    const handleAddExistingPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return;
        setIsAdding(true);

        const res = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({
                athleteId: selectedPlayer.id,
                number: searchJerseyNumber,
                communityId: teamCommunityId,
            }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newMember = await res.json();
            setMembers([...members, newMember]);
            setSearchQuery('');
            setSearchJerseyNumber('');
            setSelectedPlayer(null);
        }
        setIsAdding(false);
    };

    const handleAddNewPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFirstName) return;
        setIsAdding(true);

        const res = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({
                firstName: newFirstName,
                surname: newSurname,
                number: newJerseyNumber,
                birthDate: newBirthDate || null,
                email: newEmail || null,
                communityId: teamCommunityId,
            }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newMember = await res.json();
            setMembers([...members, newMember]);
            setNewFirstName('');
            setNewSurname('');
            setNewBirthDate('');
            setNewEmail('');
            setNewJerseyNumber('');
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

    const handleSaveTeam = async () => {
        setIsSavingTeam(true);
        const res = await fetch(`/api/teams/${teamId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: editTeamName,
                shortCode: editTeamShortCode,
                color: editTeamColor
            }),
        });

        if (res.ok) {
            setTeamName(editTeamName);
            setTeamShortCode(editTeamShortCode);
            setTeamColor(editTeamColor);
            setIsEditingTeam(false);
        }
        setIsSavingTeam(false);
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

    const activeMembers = members.filter(m => m.isActive);
    const inactiveMembers = members.filter(m => !m.isActive);

    if (loading) return <div className="p-8 text-center">Loading team details...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <Link href="/teams" className="text-sm text-slate-400 hover:text-orange-500 mb-2 inline-block">&larr; Back to Teams</Link>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        {teamColor && (
                            <div 
                                className="w-10 h-10 rounded-2xl shadow-[0_0_15px_currentColor] flex items-center justify-center text-xs font-black"
                                style={{ backgroundColor: teamColor, color: teamColor }} 
                            >
                                <span className="text-white drop-shadow-md">{teamShortCode}</span>
                            </div>
                        )}
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                {teamName}
                                <button 
                                    onClick={() => {
                                        setEditTeamName(teamName);
                                        setEditTeamShortCode(teamShortCode);
                                        setEditTeamColor(teamColor);
                                        setIsEditingTeam(true);
                                    }}
                                    className="text-slate-500 hover:text-orange-500 transition-colors bg-card/50 p-2 rounded-full hover:bg-card"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="uppercase tracking-widest font-bold text-xs">Roster</span>
                                {teamShortCode && (
                                    <>
                                        <span>•</span>
                                        <span className="font-mono bg-card px-1.5 py-0.5 rounded text-xs">{teamShortCode}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <button
                            onClick={() => setShowCommunityDropdown(!showCommunityDropdown)}
                            className="flex items-center gap-2 bg-card hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                                    className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl overflow-hidden z-50 shadow-xl"
                                >
                                    <button
                                        onClick={() => handleCommunityChange(null)}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        No Community
                                    </button>
                                    {communities.map(community => (
                                        <button
                                            key={community.id}
                                            onClick={() => handleCommunityChange(community.id)}
                                            className="w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
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
                {/* Add Player Panel */}
                <div className="space-y-6">
                    <div className="bg-card/50 p-6 rounded-2xl border border-border">
                        <h2 className="text-xl font-semibold text-orange-500 mb-4">Add Player</h2>
                        
                        {/* Tab Switcher */}
                        <div className="flex gap-1 bg-input rounded-lg p-1 mb-4">
                            <button
                                onClick={() => setActiveTab('search')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                                    activeTab === 'search' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Search size={12} />
                                Search
                            </button>
                            <button
                                onClick={() => setActiveTab('new')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                                    activeTab === 'new' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <UserPlus size={12} />
                                New
                            </button>
                            <button
                                onClick={() => setActiveTab('bulk')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                                    activeTab === 'bulk' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Users size={12} />
                                Bulk
                            </button>
                        </div>

                        {/* Search Existing Player Tab */}
                        {activeTab === 'search' && (
                            <form onSubmit={handleAddExistingPlayer} className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Search Existing Players</label>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Search by first name or surname{teamCommunityId ? ' (community + world players)' : ''}
                                    </p>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => {
                                                setSearchQuery(e.target.value);
                                                setSelectedPlayer(null);
                                                setShowPlayerSearch(true);
                                            }}
                                            onFocus={() => setShowPlayerSearch(true)}
                                            placeholder="Search by first name or surname..."
                                            className="w-full bg-input border border-border rounded-lg px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                    </div>
                                    
                                    <AnimatePresence>
                                        {showPlayerSearch && playerSearchResults.length > 0 && !selectedPlayer && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-lg overflow-hidden z-50 shadow-xl max-h-64 overflow-y-auto"
                                                style={{ width: 'calc(100% - 3rem)', marginLeft: '1.5rem' }}
                                            >
                                                {playerSearchResults.map(player => (
                                                    <button
                                                        key={player.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPlayer(player);
                                                            setSearchQuery(player.name);
                                                            setShowPlayerSearch(false);
                                                        }}
                                                        className="w-full px-3 py-3 text-left text-sm hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <div className="font-medium flex items-center gap-2">
                                                                    <User size={14} className="text-slate-500" />
                                                                    {player.name}
                                                                    {player.isWorldAvailable && (
                                                                        <span title="World Available"><Globe size={12} className="text-blue-400" /></span>
                                                                    )}
                                                                </div>
                                                                {player.birthDate && (
                                                                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 ml-5">
                                                                        <Calendar size={10} />
                                                                        DOB: {formatDate(player.birthDate)}
                                                                    </div>
                                                                )}
                                                                {player.memberships.length > 0 && (
                                                                    <div className="text-xs text-slate-500 mt-0.5 ml-5">
                                                                        Teams: {player.memberships.map(m => m.team.name).join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {player.community && (
                                                                <span className="text-xs text-slate-500 bg-muted/50 px-2 py-0.5 rounded">
                                                                    {player.community.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
            </AnimatePresence>

            {/* Team Edit Modal */}
            <AnimatePresence>
                {isEditingTeam && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsEditingTeam(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-card p-6 rounded-2xl border border-border w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-4">Edit Team Details</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Team Name</label>
                                    <input
                                        type="text"
                                        value={editTeamName}
                                        onChange={e => setEditTeamName(e.target.value)}
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Short Code</label>
                                    <input
                                        type="text"
                                        value={editTeamShortCode}
                                        onChange={e => setEditTeamShortCode(e.target.value)}
                                        maxLength={3}
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Team Color</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setEditTeamColor(c)}
                                                className={`w-6 h-6 rounded-full transition-all border ${editTeamColor === c ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                style={{ backgroundColor: c, color: c }}
                                            />
                                        ))}
                                    </div>
                                    <div className="relative flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2">
                                        <div 
                                            className="w-4 h-4 rounded-full shadow-[0_0_5px_currentColor]"
                                            style={{ backgroundColor: editTeamColor, color: editTeamColor }}
                                        />
                                        <input
                                            type="text"
                                            value={editTeamColor}
                                            onChange={e => setEditTeamColor(e.target.value)}
                                            className="bg-transparent border-none focus:outline-none text-sm font-mono text-slate-300 w-full uppercase"
                                            placeholder="#000000"
                                        />
                                        <input
                                            type="color"
                                            value={editTeamColor}
                                            onChange={e => setEditTeamColor(e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 opacity-0 absolute right-8"
                                        />
                                        <div className="text-slate-500 text-[10px] pointer-events-none uppercase ml-auto">Pick</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => setIsEditingTeam(false)}
                                    className="flex-1 bg-muted hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTeam}
                                    disabled={isSavingTeam}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isSavingTeam ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
                                </div>

                                {selectedPlayer && (
                                    <div className="bg-green-500/10 border border-green-500/20 px-3 py-3 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-green-400">
                                                <Check size={14} />
                                                <span className="font-medium">{selectedPlayer.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPlayer(null);
                                                    setSearchQuery('');
                                                }}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {selectedPlayer.birthDate && (
                                            <div className="text-xs text-green-400/70 mt-1 ml-6">
                                                DOB: {formatDate(selectedPlayer.birthDate)}
                                            </div>
                                        )}
                                        {selectedPlayer.memberships.length > 0 && (
                                            <div className="text-xs text-green-400/70 mt-0.5 ml-6">
                                                Current: {selectedPlayer.memberships.map(m => `${m.team.name} #${m.number || '??'}`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Jersey Number</label>
                                    <input
                                        type="text"
                                        value={searchJerseyNumber}
                                        onChange={e => setSearchJerseyNumber(e.target.value)}
                                        placeholder="23"
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAdding || !selectedPlayer}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Adding...' : 'Add to Team'}
                                </button>
                            </form>
                        )}

                        {/* Add New Player Tab */}
                        {activeTab === 'new' && (
                            <form onSubmit={handleAddNewPlayer} className="space-y-4">
                                <p className="text-xs text-slate-500 mb-1">
                                    Create a new player profile and add to this team.
                                </p>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                                        First Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newFirstName}
                                        onChange={e => setNewFirstName(e.target.value)}
                                        placeholder="Michael"
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                                        Surname <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newSurname}
                                        onChange={e => setNewSurname(e.target.value)}
                                        placeholder="Jordan"
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                                        Date of Birth <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={newBirthDate}
                                        onChange={e => setNewBirthDate(e.target.value)}
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Jersey Number</label>
                                    <input
                                        type="text"
                                        value={newJerseyNumber}
                                        onChange={e => setNewJerseyNumber(e.target.value)}
                                        placeholder="23"
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Email (optional)</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="player@email.com"
                                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAdding || !newFirstName || !newSurname || !newBirthDate}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Creating...' : 'Create & Add to Team'}
                                </button>
                            </form>
                        )}

                        {/* Bulk Paste Tab */}
                        {activeTab === 'bulk' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 mb-1">
                                    Paste a list of players. Format: &quot;23 Jordan&quot; or &quot;Jordan 23&quot; per line.
                                </p>
                                <textarea
                                    value={bulkInput}
                                    onChange={e => setBulkInput(e.target.value)}
                                    placeholder={"23 Jordan\n33 Pippen\n91 Rodman"}
                                    rows={8}
                                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                />
                                <button
                                    onClick={handleBulkAdd}
                                    disabled={isAdding || !bulkInput.trim()}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                                >
                                    {isAdding ? 'Adding...' : 'Add All'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Seasons */}
                    {teamSeasons.length > 0 && (
                        <div className="bg-card/20 rounded-2xl border border-border overflow-hidden">
                            <div className="px-6 py-4 bg-card/50 text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-2">
                                <Calendar size={14} />
                                Seasons ({teamSeasons.length})
                            </div>
                            <div className="divide-y divide-slate-800">
                                {teamSeasons.map(ts => (
                                    <div key={ts.id} className="px-6 py-3 flex items-center justify-between hover:bg-card/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{ts.season.name}</span>
                                            {ts.status === 'active' && (
                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {ts.season.startDate ? formatDate(ts.season.startDate) : ''}
                                            {ts.season.startDate && ts.season.endDate ? ' - ' : ''}
                                            {ts.season.endDate ? formatDate(ts.season.endDate) : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Game History */}
                    <div className="bg-card/20 rounded-2xl border border-border overflow-hidden">
                        <div className="px-6 py-4 bg-card/50 text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-2">
                            <Trophy size={14} />
                            Game History
                        </div>
                        {teamGames.length > 0 ? (
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-800">
                                    {teamGames.map(game => {
                                        const isHome = game.homeTeamId === teamId;
                                        const opponentName = isHome ? game.guestTeamName : game.homeTeamName;
                                        const teamScore = isHome ? game.homeScore : game.guestScore;
                                        const opponentScore = isHome ? game.guestScore : game.homeScore;
                                        const isWin = teamScore > opponentScore;
                                        const isLoss = teamScore < opponentScore;
                                        const result = game.status === 'final' 
                                            ? (isWin ? 'W' : isLoss ? 'L' : 'D') 
                                            : null;

                                        return (
                                            <tr 
                                                key={game.id} 
                                                className="hover:bg-card/30 transition-colors cursor-pointer group"
                                                onClick={() => window.location.href = game.status === 'live' ? `/game/${game.id}/scorer` : `/game/${game.id}/box-score`}
                                            >
                                                <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                                                    {new Date(game.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 font-bold group-hover:text-orange-500 transition-colors">
                                                    <span className="text-slate-500 font-normal mr-2">vs</span>
                                                    {opponentName}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {game.status === 'scheduled' ? (
                                                        <span className="text-xs bg-muted px-2 py-1 rounded text-slate-300">Scheduled</span>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="font-mono font-bold text-lg">
                                                                {teamScore}-{opponentScore}
                                                            </div>
                                                            {result && (
                                                                <span className={cn(
                                                                    "w-6 h-6 flex items-center justify-center rounded text-xs font-black",
                                                                    result === 'W' ? "bg-green-500/20 text-green-500" : 
                                                                    result === 'L' ? "bg-red-500/20 text-red-500" : "bg-slate-500/20 text-slate-500"
                                                                )}>
                                                                    {result}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">
                                                        {game.status === 'live' ? 'Live' : 'Details'} &rarr;
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-slate-500 italic text-sm">No games played yet.</div>
                        )}
                    </div>
                </div>

                {/* Roster Table */}
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-card/20 rounded-2xl border border-border overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-card/50 text-xs uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">#</th>
                                    <th className="px-6 py-4 font-semibold">Name</th>
                                    <th className="px-6 py-4 font-semibold hidden sm:table-cell">DOB</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {activeMembers.map(member => (
                                    <tr key={member.id} className="hover:bg-card/30 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-orange-500">{member.number || '--'}</td>
                                        <td className="px-6 py-4 font-medium">
                                            <Link href={`/players/${member.athlete.id}`} className="hover:text-orange-500 flex items-center gap-2">
                                                {member.athlete.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 hidden sm:table-cell">
                                            {member.athlete.birthDate ? formatDate(member.athlete.birthDate) : '--'}
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
                                {activeMembers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">No active players on this roster.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Inactive Members */}
                    {inactiveMembers.length > 0 && (
                        <div className="bg-card/10 rounded-2xl border border-border/50 overflow-hidden">
                            <div className="px-6 py-3 bg-card/30 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                                Former Players ({inactiveMembers.length})
                            </div>
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-800/50">
                                    {inactiveMembers.map(member => (
                                        <tr key={member.id} className="hover:bg-card/20 transition-colors text-slate-500">
                                            <td className="px-6 py-3 font-bold">{member.number || '--'}</td>
                                            <td className="px-6 py-3">
                                                <Link href={`/players/${member.athlete.id}`} className="hover:text-orange-500">
                                                    {member.athlete.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-3 text-sm hidden sm:table-cell">
                                                {member.athlete.birthDate ? formatDate(member.athlete.birthDate) : '--'}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
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
                            className="bg-card p-6 rounded-2xl border border-border w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-4">Edit Player</h3>
                            
                            <div className="mb-4">
                                <div className="text-sm text-slate-400 mb-1">Player</div>
                                <div className="font-medium">{editingMember.athlete.name}</div>
                                {editingMember.athlete.birthDate && (
                                    <div className="text-xs text-slate-500">DOB: {formatDate(editingMember.athlete.birthDate)}</div>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Jersey Number</label>
                                <input
                                    type="text"
                                    value={editNumber}
                                    onChange={e => setEditNumber(e.target.value)}
                                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingMember(null)}
                                    className="flex-1 bg-muted hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
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
