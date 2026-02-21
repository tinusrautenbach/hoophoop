'use client';

import { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Calendar, Settings, Eye, Globe, Users2 } from 'lucide-react';
import Link from 'next/link';

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    status: 'scheduled' | 'live' | 'final';
    mode: 'simple' | 'advanced';
    visibility: 'private' | 'public_general' | 'public_community';
    createdAt: string;
    ownerName: string;
    isOwner: boolean;
    community?: {
        id: string;
        name: string;
    } | null;
};

export default function GamesPage() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/games')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setGames(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500 italic">Loading Games...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-black tracking-tighter uppercase italic text-orange-500">
                    Games
                </h1>
                <Link
                    href="/"
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg hover:shadow-orange-500/20"
                >
                    New Game
                </Link>
            </div>

            {games.length === 0 ? (
                <div className="bg-card/40 p-12 rounded-3xl border border-border text-center space-y-4">
                    <Trophy size={48} className="mx-auto text-slate-600" />
                    <p className="text-slate-400">No games found. Create a new game or join a community to see games!</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {games.map(game => (
                        <Link
                            key={game.id}
                            href={`/game/${game.id}/scorer`}
                            className="bg-card/40 border border-border hover:border-orange-500/50 p-6 rounded-3xl transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight className="text-orange-500" />
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-8 flex-1">
                                    <div className="text-center min-w-[100px]">
                                        <div className="text-xs uppercase font-bold tracking-widest text-orange-500 mb-1">Home</div>
                                        <div className="text-xl font-black group-hover:text-orange-500 transition-colors uppercase">{game.homeTeamName}</div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="text-3xl font-black font-mono tracking-tighter">
                                            {game.homeScore} - {game.guestScore}
                                        </div>
                                        <div className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded mt-1 ${game.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
                                                game.status === 'final' ? 'bg-muted text-slate-300' : 'bg-card text-slate-500'
                                            }`}>
                                            {game.status}
                                        </div>
                                    </div>

                                    <div className="text-center min-w-[100px]">
                                        <div className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-1">Guest</div>
                                        <div className="text-xl font-black group-hover:text-white transition-colors uppercase text-slate-300">{game.guestTeamName}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 border-l border-border/50 pl-6 h-full text-slate-500">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest">
                                            <Calendar size={12} />
                                            {new Date(game.createdAt).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest mt-1">
                                            <Settings size={12} />
                                            {game.mode} Mode
                                        </div>
                                        <div className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest mt-1 px-1.5 py-0.5 rounded ${
                                            game.visibility === 'private' ? 'bg-card text-slate-500' :
                                            game.visibility === 'public_general' ? 'bg-green-900/30 text-green-500' :
                                            'bg-blue-900/30 text-blue-500'
                                        }`}>
                                            {game.visibility === 'private' ? <Eye size={10} /> :
                                             game.visibility === 'public_general' ? <Globe size={10} /> :
                                             <Users2 size={10} />}
                                            {game.visibility === 'private' ? 'Private' :
                                             game.visibility === 'public_general' ? 'Public' : 'Community'}
                                        </div>
                                        {!game.isOwner && (
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                                                <span>by {game.ownerName}</span>
                                            </div>
                                        )}
                                        {game.community && (
                                            <div className="flex items-center gap-1 text-[10px] text-orange-500 mt-1">
                                                <Users2 size={10} />
                                                <span>{game.community.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
