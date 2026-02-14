'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Check, X, Merge, User, AlertTriangle, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Player = {
    id: string;
    name: string;
    firstName: string | null;
    surname: string | null;
    birthDate: string | null;
    communityName?: string;
    currentTeams: string[];
};

export default function MergePlayersPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [primaryId, setPrimaryId] = useState<string | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.length < 2) return;

        const res = await fetch(`/api/players?q=${searchQuery}&includeInactive=true`);
        if (res.ok) {
            const data = await res.json();
            // Filter out players already selected
            const filtered = data.filter((p: Player) => !selectedPlayers.find(sp => sp.id === p.id));
            setSearchResults(filtered);
        }
    };

    const handleSelect = (player: Player) => {
        if (selectedPlayers.find(p => p.id === player.id)) return;
        
        const newSelection = [...selectedPlayers, player];
        setSelectedPlayers(newSelection);
        setSearchResults(searchResults.filter(p => p.id !== player.id));
        
        // Auto-select first added as primary if none selected
        if (!primaryId) setPrimaryId(player.id);
    };

    const handleRemove = (playerId: string) => {
        setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
        if (primaryId === playerId) setPrimaryId(null);
    };

    const handleMerge = async () => {
        if (!primaryId || selectedPlayers.length < 2) return;
        
        const duplicates = selectedPlayers.filter(p => p.id !== primaryId);
        const confirmMsg = `Are you sure you want to merge ${duplicates.length} players into ${selectedPlayers.find(p => p.id === primaryId)?.name}? This cannot be undone.`;
        
        if (!confirm(confirmMsg)) return;

        setIsMerging(true);
        try {
            const res = await fetch('/api/players/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryId,
                    duplicateIds: duplicates.map(p => p.id)
                })
            });

            if (res.ok) {
                alert('Players merged successfully!');
                router.push('/admin');
            } else {
                const err = await res.json();
                alert(`Merge failed: ${err.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('Merge failed due to network error');
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.push('/admin')} className="p-2 hover:bg-card rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Merge Players</h1>
                    <p className="text-slate-500">Consolidate duplicate player profiles into a single record.</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left: Search & Results */}
                <div className="space-y-6">
                    <div className="bg-input border border-border p-6 rounded-2xl">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Search size={20} className="text-orange-500" />
                            Find Players
                        </h2>
                        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name..."
                                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                            />
                            <button type="submit" className="bg-card hover:bg-muted text-white font-bold px-6 py-3 rounded-xl transition-colors">
                                Search
                            </button>
                        </form>

                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {searchResults.map(player => (
                                <button
                                    key={player.id}
                                    onClick={() => handleSelect(player)}
                                    className="w-full text-left bg-background/50 border border-border p-3 rounded-xl hover:border-orange-500/50 transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold group-hover:text-orange-500 transition-colors">{player.name}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {player.birthDate ? `DOB: ${new Date(player.birthDate).toLocaleDateString()}` : 'No DOB'}
                                            </div>
                                            {player.communityName && (
                                                <div className="text-xs text-slate-600 mt-1">{player.communityName}</div>
                                            )}
                                        </div>
                                        <PlusIcon />
                                    </div>
                                </button>
                            ))}
                            {searchResults.length === 0 && searchQuery && (
                                <div className="text-center text-slate-500 py-8 text-sm">No results found</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Merge Staging */}
                <div className="space-y-6">
                    <div className="bg-input border border-border p-6 rounded-2xl min-h-[400px] flex flex-col">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Merge size={20} className="text-blue-500" />
                            Merge Candidates
                        </h2>
                        
                        {selectedPlayers.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-border rounded-xl p-8">
                                <User size={48} className="mb-4 opacity-50" />
                                <p>Select players from the search results to add them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-1">
                                <div className="text-sm text-slate-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                    Select the "Primary" profile. All other profiles listed here will be merged into it and deactivated.
                                </div>

                                {selectedPlayers.map(player => (
                                    <div 
                                        key={player.id}
                                        className={cn(
                                            "relative p-4 rounded-xl border-2 transition-all cursor-pointer",
                                            primaryId === player.id 
                                                ? "bg-orange-500/10 border-orange-500" 
                                                : "bg-background border-border hover:border-slate-600"
                                        )}
                                        onClick={() => setPrimaryId(player.id)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                                    primaryId === player.id ? "border-orange-500 bg-orange-500 text-white" : "border-slate-600"
                                                )}>
                                                    {primaryId === player.id && <Check size={14} strokeWidth={3} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-lg">{player.name}</div>
                                                    <div className="text-xs text-slate-500">ID: {player.id.substring(0, 8)}...</div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRemove(player.id); }}
                                                className="p-1 hover:bg-card rounded text-slate-500 hover:text-white"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-input/50 p-2 rounded">
                                                <span className="text-slate-500 block">DOB</span>
                                                {player.birthDate || '--'}
                                            </div>
                                            <div className="bg-input/50 p-2 rounded">
                                                <span className="text-slate-500 block">Community</span>
                                                {player.communityName || 'None'}
                                            </div>
                                            <div className="col-span-2 bg-input/50 p-2 rounded">
                                                <span className="text-slate-500 block">Current Teams</span>
                                                {player.currentTeams?.join(', ') || 'None'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-border">
                            <button
                                onClick={handleMerge}
                                disabled={selectedPlayers.length < 2 || !primaryId || isMerging}
                                className={cn(
                                    "w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all",
                                    selectedPlayers.length < 2 || !primaryId
                                        ? "bg-card text-slate-500 cursor-not-allowed"
                                        : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20"
                                )}
                            >
                                {isMerging ? 'Merging...' : 'Merge Profiles'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlusIcon() {
    return (
        <div className="bg-card p-1 rounded group-hover:bg-orange-500 group-hover:text-white transition-colors">
            <Plus size={16} />
        </div>
    );
}
