'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Plus, Users, Shield, Calendar, X } from 'lucide-react';
import { CommunitySelector } from '@/components/community-selector';
import { SeasonSelector } from '@/components/season-selector';

type Team = {
    id: string;
    name: string;
    shortCode: string | null;
    color: string | null;
    community: { name: string } | null;
    teamSeasons: Array<{ season: { name: string } }>;
};

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [shortCode, setShortCode] = useState('');
    const [color, setColor] = useState('#f97316'); // Default orange-500
    const [communityId, setCommunityId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    // Filtering state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
    const [filterSeasonId, setFilterSeasonId] = useState<string | null>(null);
    const [myTeamsOnly, setMyTeamsOnly] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (filterCommunityId) params.append('communityId', filterCommunityId);
            if (filterSeasonId) params.append('seasonId', filterSeasonId);
            if (myTeamsOnly) params.append('myTeams', 'true');

            try {
                const res = await fetch(`/api/teams?${params.toString()}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setTeams(data);
                } else {
                    setTeams([]);
                }
            } catch (err) {
                console.error('Failed to fetch teams:', err);
                setTeams([]);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchTeams();
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, filterCommunityId, filterSeasonId, myTeamsOnly]);

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        const res = await fetch('/api/teams', {
            method: 'POST',
            body: JSON.stringify({ name, shortCode, color, communityId }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const newTeam = await res.json();
            setTeams([newTeam, ...teams]);
            setName('');
            setShortCode('');
            setColor('#f97316');
            setCommunityId(null);
        }
        setIsCreating(false);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-black uppercase tracking-tight">Teams</h1>
                
                <div className="flex items-center gap-2 bg-input border border-border rounded-xl p-1">
                    <button
                        onClick={() => setMyTeamsOnly(true)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${myTeamsOnly ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        My Teams
                    </button>
                    <button
                        onClick={() => setMyTeamsOnly(false)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${!myTeamsOnly ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        All Teams
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-input border border-border rounded-3xl p-6 shadow-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search teams by name..."
                            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-all"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    <CommunitySelector 
                        selectedCommunityId={filterCommunityId} 
                        onSelect={setFilterCommunityId}
                        className="w-full py-3"
                    />
                    
                    <SeasonSelector 
                        communityId={filterCommunityId || undefined} 
                        selectedSeasonId={filterSeasonId} 
                        onSelect={setFilterSeasonId}
                        className="w-full py-3"
                    />
                </div>
                
                {(searchQuery || filterCommunityId || filterSeasonId) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {searchQuery && (
                            <span className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                Query: {searchQuery}
                                <X size={12} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                            </span>
                        )}
                        {filterCommunityId && (
                            <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                Community Filter
                                <X size={12} className="cursor-pointer" onClick={() => setFilterCommunityId(null)} />
                            </span>
                        )}
                        {filterSeasonId && (
                            <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                Season Filter
                                <X size={12} className="cursor-pointer" onClick={() => setFilterSeasonId(null)} />
                            </span>
                        )}
                        <button 
                            onClick={() => {
                                setSearchQuery('');
                                setFilterCommunityId(null);
                                setFilterSeasonId(null);
                            }}
                            className="text-xs text-slate-500 hover:text-white font-bold uppercase tracking-wider"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Create Team Sidebar (Admin Only or Personal) */}
                <div className="lg:col-span-1">
                    <div className="bg-input border border-border rounded-3xl p-6 shadow-xl sticky top-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Plus className="text-orange-500" size={20} />
                            <h2 className="text-xl font-black uppercase tracking-tight">New Team</h2>
                        </div>
                        
                        <form onSubmit={handleCreateTeam} className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Team Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Bulls"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Short Code</label>
                                <input
                                    type="text"
                                    value={shortCode}
                                    onChange={e => setShortCode(e.target.value)}
                                    placeholder="e.g. CHI"
                                    maxLength={3}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Team Color</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-full transition-all border-2 ${color === c ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'}`}
                                            style={{ backgroundColor: c, color: c }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-2">
                                    <div 
                                        className="w-6 h-6 rounded-full shadow-[0_0_10px_currentColor]"
                                        style={{ backgroundColor: color, color: color }}
                                    />
                                    <input
                                        type="text"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="bg-transparent border-none focus:outline-none text-sm font-mono text-slate-300 w-full uppercase"
                                        placeholder="#000000"
                                    />
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 opacity-0 absolute right-8"
                                    />
                                    <div className="text-slate-500 text-xs pointer-events-none">PICK</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Assign to Community</label>
                                <CommunitySelector 
                                    selectedCommunityId={communityId} 
                                    onSelect={setCommunityId}
                                    className="w-full py-3"
                                />
                            </div>
                            <button
                                disabled={isCreating}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50 mt-4"
                            >
                                {isCreating ? 'Creating...' : 'Create Team'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Teams List */}
                <div className="lg:col-span-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Finding teams...</p>
                        </div>
                    ) : teams.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {teams.map(team => (
                                <Link key={team.id} href={`/teams/${team.id}`} className="group">
                                    <div className="bg-input border border-border p-8 rounded-3xl hover:border-orange-500 transition-all group-hover:shadow-2xl group-hover:shadow-orange-500/10 group-hover:-translate-y-1 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-16 h-16 bg-background border border-border rounded-2xl flex items-center justify-center text-3xl font-black group-hover:text-orange-500 transition-colors">
                                                    {team.shortCode || team.name.slice(0, 3).toUpperCase()}
                                                </div>
                                                {team.color && (
                                                    <div 
                                                        className="w-4 h-4 rounded-full shadow-[0_0_15px_currentColor]"
                                                        style={{ backgroundColor: team.color, color: team.color }} 
                                                    />
                                                )}
                                            </div>
                                            <h3 className="font-black text-2xl mb-2">{team.name}</h3>
                                            
                                            <div className="space-y-2 mb-6">
                                                {team.community && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <Shield size={14} className="text-blue-500" />
                                                        <span>{team.community.name}</span>
                                                    </div>
                                                )}
                                                {team.teamSeasons && team.teamSeasons.length > 0 && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <Calendar size={14} className="text-green-500" />
                                                        <span>{team.teamSeasons[0].season.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-6 border-t border-border/50">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">View Roster</span>
                                            <Plus size={16} className="text-orange-500" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-input/50 border border-border border-dashed rounded-3xl p-20 text-center">
                            <Users size={48} className="mx-auto text-slate-700 mb-4" />
                            <h3 className="text-xl font-bold text-slate-400 mb-2">No Teams Found</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8">
                                Try adjusting your filters or search terms to find what you're looking for.
                            </p>
                            <button 
                                onClick={() => {
                                    setSearchQuery('');
                                    setFilterCommunityId(null);
                                    setFilterSeasonId(null);
                                }}
                                className="bg-card hover:bg-muted text-white font-bold px-8 py-3 rounded-xl transition-all"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

