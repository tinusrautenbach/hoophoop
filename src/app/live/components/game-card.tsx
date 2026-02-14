'use client';

import Link from 'next/link';

interface GameCardProps {
    game: {
        id: string;
        homeTeamName: string;
        guestTeamName: string;
        homeScore: number;
        guestScore: number;
        homeFouls: number;
        guestFouls: number;
        homeTimeouts: number;
        guestTimeouts: number;
        totalTimeouts: number;
        currentPeriod: number;
        totalPeriods: number;
        periodSeconds: number;
        clockSeconds: number;
        possession: 'home' | 'guest' | null;
        mode: 'simple' | 'advanced';
        status: 'scheduled' | 'live' | 'final';
        isTimerRunning: boolean;
        community?: {
            id: string;
            name: string;
            slug: string;
        } | null;
        homeTeam?: {
            id: string;
            name: string;
            shortCode?: string;
            color?: string;
        } | null;
        guestTeam?: {
            id: string;
            name: string;
            shortCode?: string;
            color?: string;
        } | null;
    };
}

export function GameCard({ game }: GameCardProps) {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getPeriodLabel = (period: number, totalPeriods: number) => {
        if (period > totalPeriods) {
            return period === totalPeriods + 1 ? 'OT' : `${period - totalPeriods}OT`;
        }
        return `Q${period}`;
    };

    const isLive = game.status === 'live';
    const isFinal = game.status === 'final';

    return (
        <Link href={`/game/${game.id}`}>
            <div className="bg-card/50 border border-border rounded-lg p-4 hover:bg-card transition-colors cursor-pointer group">
                {/* Community Badge */}
                {game.community && (
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">
                            {game.community.name}
                        </span>
                        {isLive && (
                            <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                LIVE
                            </span>
                        )}
                        {isFinal && (
                            <span className="text-xs text-slate-500 font-medium">
                                FINAL
                            </span>
                        )}
                    </div>
                )}

                {/* Teams & Scores */}
                <div className="space-y-3">
                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {game.homeTeam?.color && (
                                <div
                                    className="w-3 h-8 rounded-full"
                                    style={{ backgroundColor: game.homeTeam.color }}
                                />
                            )}
                            <div>
                                <div className="font-semibold text-slate-100">
                                    {game.homeTeam?.shortCode || game.homeTeamName}
                                </div>
                                {game.homeTeam?.name && game.homeTeam.name !== game.homeTeamName && (
                                    <div className="text-xs text-slate-500">{game.homeTeam.name}</div>
                                )}
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${isLive ? 'text-orange-400' : 'text-slate-100'}`}>
                            {game.homeScore}
                        </div>
                    </div>

                    {/* Guest Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {game.guestTeam?.color && (
                                <div
                                    className="w-3 h-8 rounded-full"
                                    style={{ backgroundColor: game.guestTeam.color }}
                                />
                            )}
                            <div>
                                <div className="font-semibold text-slate-100">
                                    {game.guestTeam?.shortCode || game.guestTeamName}
                                </div>
                                {game.guestTeam?.name && game.guestTeam.name !== game.guestTeamName && (
                                    <div className="text-xs text-slate-500">{game.guestTeam.name}</div>
                                )}
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${isLive ? 'text-orange-400' : 'text-slate-100'}`}>
                            {game.guestScore}
                        </div>
                    </div>
                </div>

                {/* Game Info */}
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{getPeriodLabel(game.currentPeriod, game.totalPeriods)}</span>
                        {isLive && (
                            <>
                                <span>•</span>
                                <span className="text-orange-400 font-mono">
                                    {formatTime(game.clockSeconds)}
                                </span>
                            </>
                        )}
                    </div>
                    {game.possession && (
                        <div className="text-xs text-slate-500">
                            Poss: {game.possession === 'home' ? '▶' : '◀'}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
