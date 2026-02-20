'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Download, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSocket } from '@/hooks/use-socket';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type EventType = 'score' | 'foul' | 'timeout' | 'sub' | 'turnover' | 'block' | 'steal' | 'rebound_off' | 'rebound_def' | 'period_start' | 'period_end' | 'clock_start' | 'clock_stop' | 'undo' | 'miss';

type GameEvent = {
    id: string;
    type: EventType;
    period: number;
    clockAt: number;
    team: 'home' | 'guest';
    player?: string;
    value?: number;
    metadata?: {
        points?: number;
        shotType?: '2pt' | '3pt' | 'ft';
        made?: boolean;
    };
    description: string;
};

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    points: number;
    fouls: number;
    isActive: boolean;
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    currentPeriod: number;
    totalPeriods: number;
    status: 'scheduled' | 'live' | 'final';
    rosters: RosterEntry[];
    events: GameEvent[];
};

type PlayerStats = {
    points: number;
    fouls: number;
    minutes: number;
    // Shooting stats
    fgMade: number;
    fgAttempted: number;
    fgPercentage: number;
    ftMade: number;
    ftAttempted: number;
    ftPercentage: number;
    threePtMade: number;
    threePtAttempted: number;
    threePtPercentage: number;
};

type TeamStats = {
    score: number;
    fouls: number;
    players: number;
    activePlayers: number;
    // Shooting stats - aggregated from players
    fgMade: number;
    fgAttempted: number;
    fgPercentage: number;
    ftMade: number;
    ftAttempted: number;
    ftPercentage: number;
    threePtMade: number;
    threePtAttempted: number;
    threePtPercentage: number;
    // Individual player stats
    playerStats: { [key: string]: PlayerStats };
};

export default function BoxScorePage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket } = useSocket(id as string);
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setLoading(false);
            });
    }, [id]);

    // Listen for real-time updates
    useEffect(() => {
        if (!socket) return;

        const handleGameState = ({ game: gameState, events }: { game: Game, events: GameEvent[] }) => {
            setGame({ ...gameState, events });
        };

        socket.on('game-state', handleGameState);
        socket.on('game-updated', (updates: Partial<Game>) => {
            setGame(prev => prev ? { ...prev, ...updates } : null);
        });

        if (socket.connected) {
            socket.emit('join-game', id);
        }

        return () => {
            socket.off('game-state', handleGameState);
            socket.off('game-updated');
        };
    }, [socket, id]);

    const calculateTeamStats = (team: 'home' | 'guest'): TeamStats => {
        if (!game) return {
            score: 0, fouls: 0, players: 0, activePlayers: 0,
            fgMade: 0, fgAttempted: 0, fgPercentage: 0,
            ftMade: 0, ftAttempted: 0, ftPercentage: 0,
            threePtMade: 0, threePtAttempted: 0, threePtPercentage: 0,
            playerStats: {}
        };

        const roster = game.rosters?.filter(r => r.team === team) || [];
        // Ensure events array exists before filtering
        const events = (game.events || []).filter(e => e.team === team);

        // Use game score directly (source of truth)
        const score = team === 'home' ? game.homeScore : game.guestScore;
        const fouls = team === 'home' ? game.homeFouls : game.guestFouls;

        // Initialize player stats (start with 0 to avoid double counting)
        const playerStats: { [key: string]: PlayerStats } = {};

        // Initialize from roster names
        roster.forEach(player => {
            playerStats[player.name] = {
                points: 0,
                fouls: 0,
                minutes: 0,
                fgMade: 0,
                fgAttempted: 0,
                fgPercentage: 0,
                ftMade: 0,
                ftAttempted: 0,
                ftPercentage: 0,
                threePtMade: 0,
                threePtAttempted: 0,
                threePtPercentage: 0
            };
        });

        // Track if we found any event data for this team
        let hasEventPoints = false;

        // Process events to build detailed player stats
        events.forEach(event => {
            // If player is null (e.g. for team stats or simple mode), use the team name as fallback
            // This ensures stats are captured and aggregated even if not assigned to a specific player
            const teamName = team === 'home' ? game.homeTeamName : game.guestTeamName;
            const playerName = event.player || teamName;

            // Ensure player exists in stats (for adhoc players not in roster)
            if (!playerStats[playerName]) {
                playerStats[playerName] = {
                    points: 0,
                    fouls: 0,
                    minutes: 0,
                    fgMade: 0,
                    fgAttempted: 0,
                    fgPercentage: 0,
                    ftMade: 0,
                    ftAttempted: 0,
                    ftPercentage: 0,
                    threePtMade: 0,
                    threePtAttempted: 0,
                    threePtPercentage: 0
                };
            }

            if (event.type === 'score') {
                // Get points from either metadata.points or event.value
                const points = Number(event.metadata?.points ?? event.value ?? 0);

                if (points > 0) {
                    playerStats[playerName].points += points;
                    hasEventPoints = true;
                }

                // For 'score' events, we infer shot type from points if metadata is missing
                // 1 pt = FT
                // 2 pts = 2PT FG
                // 3 pts = 3PT FG
                const shotType = event.metadata?.shotType;

                if (shotType === 'ft' || (!shotType && points === 1)) {
                    playerStats[playerName].ftMade++;
                    playerStats[playerName].ftAttempted++;
                } else if (shotType === '3pt' || (!shotType && points === 3)) {
                    playerStats[playerName].threePtMade++;
                    playerStats[playerName].threePtAttempted++;
                    playerStats[playerName].fgMade++;
                    playerStats[playerName].fgAttempted++;
                } else if (shotType === '2pt' || (!shotType && points === 2)) {
                    playerStats[playerName].fgMade++;
                    playerStats[playerName].fgAttempted++;
                }
            } else if (event.type === 'miss') {
                // For miss events, we check value or metadata
                const shotType = event.metadata?.shotType;
                const value = Number(event.value || 0);

                if (shotType === 'ft' || (!shotType && value === 1)) {
                    playerStats[playerName].ftAttempted++;
                } else if (shotType === '3pt' || (!shotType && value === 3)) {
                    playerStats[playerName].threePtAttempted++;
                    playerStats[playerName].fgAttempted++;
                } else if (shotType === '2pt' || (!shotType && value === 2)) {
                    playerStats[playerName].fgAttempted++;
                }
            } else if (event.type === 'foul') {
                playerStats[playerName].fouls++;
            }
        });

        // Fallback: If no points were calculated from events, use roster data
        if (!hasEventPoints) {
            roster.forEach(player => {
                if (playerStats[player.name]) {
                    playerStats[player.name].points = player.points || 0;
                    playerStats[player.name].fouls = player.fouls || 0;
                }
            });
        }

        // Calculate minutes played for each player
        // Track when each player is on the court
        const playerOnCourt: { [key: string]: { period: number; clockAt: number } | null } = {};
        roster.forEach(player => {
            playerOnCourt[player.name] = null;
        });

        // Get all team events sorted by time (oldest first)
        const sortedEvents = [...events].sort((a, b) => {
            if (a.period !== b.period) return a.period - b.period;
            return b.clockAt - a.clockAt; // Higher clockAt = earlier in period
        });

        // Determine period length (default to 600 seconds = 10 minutes)
        const periodLength = 600;

        // Track active players at the start of each period
        const lastPeriodEndClock: { [key: number]: number } = {};

        sortedEvents.forEach(event => {
            const playerName = event.player;
            if (!playerName || !playerStats[playerName]) return;

            if (event.type === 'period_start') {
                // At period start, any active player starts playing
                roster.filter(p => p.isActive).forEach(p => {
                    playerOnCourt[p.name] = { period: event.period, clockAt: periodLength };
                });
            } else if (event.type === 'period_end') {
                // At period end, all players stop playing
                Object.keys(playerOnCourt).forEach(name => {
                    if (playerOnCourt[name]) {
                        const timeOnCourt = periodLength - event.clockAt;
                        playerStats[name].minutes += timeOnCourt / 60;
                        playerOnCourt[name] = null;
                    }
                });
                lastPeriodEndClock[event.period] = event.clockAt;
            } else if (event.type === 'sub') {
                // Handle substitutions
                const isSubbingIn = event.description?.includes(' In') || event.description?.endsWith(' In');
                const isSubbingOut = event.description?.includes(' Benched') || event.description?.endsWith(' Benched');

                if (isSubbingIn && !playerOnCourt[playerName]) {
                    // Player entering the court
                    playerOnCourt[playerName] = { period: event.period, clockAt: event.clockAt };
                } else if (isSubbingOut && playerOnCourt[playerName]) {
                    // Player leaving the court
                    const startTime = playerOnCourt[playerName]!;
                    if (startTime.period === event.period) {
                        const timeOnCourt = startTime.clockAt - event.clockAt;
                        playerStats[playerName].minutes += timeOnCourt / 60;
                    }
                    playerOnCourt[playerName] = null;
                }
            }
        });

        // Handle players still on court at game end
        const lastPeriod = game.currentPeriod;
        const lastClock = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].clockAt : periodLength;
        Object.keys(playerOnCourt).forEach(name => {
            if (playerOnCourt[name]) {
                const startTime = playerOnCourt[name]!;
                if (startTime.period === lastPeriod) {
                    const timeOnCourt = startTime.clockAt - lastClock;
                    playerStats[name].minutes += timeOnCourt / 60;
                }
                playerOnCourt[name] = null;
            }
        });

        // Round minutes to 1 decimal place
        Object.keys(playerStats).forEach(name => {
            playerStats[name].minutes = Math.round(playerStats[name].minutes * 10) / 10;
        });

        // Calculate percentages for each player
        Object.keys(playerStats).forEach(playerName => {
            const stats = playerStats[playerName];
            stats.fgPercentage = stats.fgAttempted > 0 ? Math.round((stats.fgMade / stats.fgAttempted) * 100) : 0;
            stats.ftPercentage = stats.ftAttempted > 0 ? Math.round((stats.ftMade / stats.ftAttempted) * 100) : 0;
            stats.threePtPercentage = stats.threePtAttempted > 0 ? Math.round((stats.threePtMade / stats.threePtAttempted) * 100) : 0;
        });

        // Calculate team totals from player stats
        let teamFgMade = 0, teamFgAttempted = 0;
        let teamFtMade = 0, teamFtAttempted = 0;
        let team3PtMade = 0, team3PtAttempted = 0;

        Object.values(playerStats).forEach(stats => {
            teamFgMade += stats.fgMade;
            teamFgAttempted += stats.fgAttempted;
            teamFtMade += stats.ftMade;
            teamFtAttempted += stats.ftAttempted;
            team3PtMade += stats.threePtMade;
            team3PtAttempted += stats.threePtAttempted;
        });

        return {
            score,
            fouls,
            players: roster.length,
            activePlayers: roster.filter(r => r.isActive).length,
            fgMade: teamFgMade,
            fgAttempted: teamFgAttempted,
            fgPercentage: teamFgAttempted > 0 ? Math.round((teamFgMade / teamFgAttempted) * 100) : 0,
            ftMade: teamFtMade,
            ftAttempted: teamFtAttempted,
            ftPercentage: teamFtAttempted > 0 ? Math.round((teamFtMade / teamFtAttempted) * 100) : 0,
            threePtMade: team3PtMade,
            threePtAttempted: team3PtAttempted,
            threePtPercentage: team3PtAttempted > 0 ? Math.round((team3PtMade / team3PtAttempted) * 100) : 0,
            playerStats
        };
    };

    const generateStandaloneHTML = () => {
        if (!game) return '';

        const homeStats = calculateTeamStats('home');
        const guestStats = calculateTeamStats('guest');

        const homeRoster = game.rosters?.filter(r => r.team === 'home') || [];
        const guestRoster = game.rosters?.filter(r => r.team === 'guest') || [];

        const now = new Date().toLocaleString();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${game.homeTeamName} vs ${game.guestTeamName} - Box Score</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #fff;
            line-height: 1.6;
            padding: 16px;
        }
        .container { max-width: 100%; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }
        .header h1 { 
            text-align: center; 
            font-size: 1.25rem; 
            margin-bottom: 16px;
            color: #fb923c;
        }
        .scoreboard {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #1e293b;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .team {
            text-align: center;
            flex: 1;
        }
        .team-name {
            font-size: 0.875rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }
        .home-team { color: #fb923c; }
        .guest-team { color: #fff; }
        .team-score {
            font-size: 2.5rem;
            font-weight: 900;
        }
        .vs {
            font-size: 0.875rem;
            color: #64748b;
            padding: 0 12px;
        }
        .game-info {
            text-align: center;
            font-size: 0.75rem;
            color: #94a3b8;
            margin-top: 8px;
        }
        .shooting-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 12px;
        }
        .shooting-box {
            background: #0f172a;
            padding: 8px;
            border-radius: 6px;
            text-align: center;
        }
        .shooting-label {
            font-size: 0.625rem;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 2px;
        }
        .shooting-value {
            font-size: 0.875rem;
            font-weight: 800;
        }
        .teams-container {
            display: grid;
            gap: 20px;
        }
        .team-section {
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #334155;
            overflow-x: auto;
        }
        .team-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 2px solid #334155;
        }
        .team-header h2 {
            font-size: 1.125rem;
            font-weight: 900;
            text-transform: uppercase;
        }
        .team-stats {
            display: flex;
            gap: 12px;
            font-size: 0.875rem;
        }
        .stat {
            text-align: center;
        }
        .stat-label {
            font-size: 0.625rem;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.05em;
        }
        .stat-value {
            font-size: 1.25rem;
            font-weight: 800;
        }
        .players-table {
            width: 100%;
            min-width: 600px;
        }
        .table-header {
            display: grid;
            grid-template-columns: 35px 1fr 45px 45px 45px 55px 55px 55px;
            gap: 6px;
            padding: 8px 0;
            border-bottom: 1px solid #334155;
            font-size: 0.625rem;
            font-weight: bold;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.05em;
            text-align: center;
        }
        .table-header > div:first-child,
        .table-header > div:nth-child(2) {
            text-align: left;
        }
        .player-row {
            display: grid;
            grid-template-columns: 35px 1fr 45px 45px 45px 55px 55px 55px;
            gap: 6px;
            padding: 10px 0;
            border-bottom: 1px solid #334155;
            align-items: center;
        }
        .player-row:last-child { border-bottom: none; }
        .player-number {
            width: 30px;
            height: 30px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.8rem;
        }
        .home-team .player-number { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
        .guest-team .player-number { background: #334155; color: #94a3b8; }
        .player-name {
            font-weight: 600;
            font-size: 0.875rem;
        }
        .player-subtext {
            font-size: 0.7rem;
            color: #64748b;
        }
        .stat-cell {
            text-align: center;
            font-size: 0.9rem;
            font-weight: 700;
        }
        .shooting-cell {
            text-align: center;
            font-size: 0.8rem;
        }
        .shooting-made {
            font-weight: 700;
        }
        .shooting-pct {
            font-size: 0.7rem;
            color: #94a3b8;
        }
        .status {
            text-align: center;
        }
        .status-badge {
            display: inline-block;
            padding: 3px 6px;
            border-radius: 9999px;
            font-size: 0.6rem;
            font-weight: 800;
            text-transform: uppercase;
        }
        .home-team .status-active { background: #fb923c; color: #fff; }
        .home-team .status-bench { color: #64748b; }
        .guest-team .status-active { background: #fff; color: #0f172a; }
        .guest-team .status-bench { color: #64748b; }
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 16px;
            font-size: 0.75rem;
            color: #64748b;
            border-top: 1px solid #334155;
        }
        .footer strong { color: #fb923c; }
        @media (min-width: 768px) {
            body { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏀 BOX SCORE</h1>
            <div class="scoreboard">
                <div class="team">
                    <div class="team-name home-team">${game.homeTeamName}</div>
                    <div class="team-score" style="color: #fb923c;">${homeStats.score}</div>
                    <div style="font-size: 0.75rem; color: #fb923c; margin-top: 4px;">${homeStats.fouls} Fouls</div>
                </div>
                <div class="vs">VS</div>
                <div class="team">
                    <div class="team-name guest-team">${game.guestTeamName}</div>
                    <div class="team-score">${guestStats.score}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">${guestStats.fouls} Fouls</div>
                </div>
            </div>
            
            <!-- Shooting Stats Summary -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                <div class="home-team">
                    <div style="font-size: 0.625rem; text-transform: uppercase; color: #fb923c; margin-bottom: 4px; text-align: center;">Home Team Shooting</div>
                    <div class="shooting-stats">
                        <div class="shooting-box">
                            <div class="shooting-label">FG%</div>
                            <div class="shooting-value" style="color: #fb923c;">${homeStats.fgMade}/${homeStats.fgAttempted} ${homeStats.fgPercentage}%</div>
                        </div>
                        <div class="shooting-box">
                            <div class="shooting-label">3PT%</div>
                            <div class="shooting-value" style="color: #fb923c;">${homeStats.threePtMade}/${homeStats.threePtAttempted} ${homeStats.threePtPercentage}%</div>
                        </div>
                        <div class="shooting-box">
                            <div class="shooting-label">FT%</div>
                            <div class="shooting-value" style="color: #fb923c;">${homeStats.ftMade}/${homeStats.ftAttempted} ${homeStats.ftPercentage}%</div>
                        </div>
                    </div>
                </div>
                <div class="guest-team">
                    <div style="font-size: 0.625rem; text-transform: uppercase; color: #fff; margin-bottom: 4px; text-align: center;">Guest Team Shooting</div>
                    <div class="shooting-stats">
                        <div class="shooting-box">
                            <div class="shooting-label">FG%</div>
                            <div class="shooting-value">${guestStats.fgMade}/${guestStats.fgAttempted} ${guestStats.fgPercentage}%</div>
                        </div>
                        <div class="shooting-box">
                            <div class="shooting-label">3PT%</div>
                            <div class="shooting-value">${guestStats.threePtMade}/${guestStats.threePtAttempted} ${guestStats.threePtPercentage}%</div>
                        </div>
                        <div class="shooting-box">
                            <div class="shooting-label">FT%</div>
                            <div class="shooting-value">${guestStats.ftMade}/${guestStats.ftAttempted} ${guestStats.ftPercentage}%</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="game-info">
                ${game.status === 'final' ? 'Final' : `Period ${game.currentPeriod} of ${game.totalPeriods}`} • Generated ${now}
            </div>
        </div>
        
        <div class="teams-container">
            <!-- Home Team -->
            <div class="team-section home-team">
                <div class="team-header">
                    <h2 style="color: #fb923c;">${game.homeTeamName}</h2>
                    <div class="team-stats">
                        <div class="stat">
                            <div class="stat-label">Score</div>
                            <div class="stat-value" style="color: #fb923c;">${homeStats.score}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Players</div>
                            <div class="stat-value">${homeStats.players}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Fouls</div>
                            <div class="stat-value">${homeStats.fouls}</div>
                        </div>
                    </div>
                </div>
                
                <div class="players-table">
                    <div class="table-header">
                        <div>#</div>
                        <div>Player</div>
                        <div>PTS</div>
                        <div>FL</div>
                        <div>MIN</div>
                        <div>FG%</div>
                        <div>3PT%</div>
                        <div>FT%</div>
                    </div>
                    ${homeRoster
                .sort((a, b) => {
                    const aStats = homeStats.playerStats[a.name] || { points: 0 };
                    const bStats = homeStats.playerStats[b.name] || { points: 0 };
                    return bStats.points - aStats.points || parseInt(a.number) - parseInt(b.number);
                })
                .map(p => {
                    const stats = homeStats.playerStats[p.name] || {
                        points: 0, fouls: 0, minutes: 0, fgMade: 0, fgAttempted: 0, fgPercentage: 0,
                        threePtMade: 0, threePtAttempted: 0, threePtPercentage: 0,
                        ftMade: 0, ftAttempted: 0, ftPercentage: 0
                    };
                    return `
                        <div class="player-row">
                            <div class="player-number">${p.number}</div>
                            <div>
                                <div class="player-name">${p.name}</div>
                                <div class="player-subtext">${stats.points > 0 || stats.fouls > 0 ? (stats.points > 0 ? stats.points + ' pts' : '') + (stats.points > 0 && stats.fouls > 0 ? ' • ' : '') + (stats.fouls > 0 ? stats.fouls + ' fouls' : '') : (p.isActive ? 'Active' : 'Bench')}</div>
                            </div>
                            <div class="stat-cell" style="color: ${stats.points > 0 ? '#fb923c' : '#475569'};">${stats.points}</div>
                            <div class="stat-cell" style="color: ${stats.fouls >= 5 ? '#ef4444' : stats.fouls > 0 ? '#94a3b8' : '#475569'};">${stats.fouls}</div>
                            <div class="stat-cell" style="color: ${stats.minutes > 0 ? '#fb923c' : '#475569'};">${stats.minutes}</div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.fgMade > 0 ? '#fb923c' : '#475569'};">${stats.fgMade}/${stats.fgAttempted}</div>
                                <div class="shooting-pct">${stats.fgPercentage}%</div>
                            </div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.threePtMade > 0 ? '#fb923c' : '#475569'};">${stats.threePtMade}/${stats.threePtAttempted}</div>
                                <div class="shooting-pct">${stats.threePtPercentage}%</div>
                            </div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.ftMade > 0 ? '#fb923c' : '#475569'};">${stats.ftMade}/${stats.ftAttempted}</div>
                                <div class="shooting-pct">${stats.ftPercentage}%</div>
                            </div>
                        </div>
                        `}).join('')}
                </div>
            </div>
            
            <!-- Guest Team -->
            <div class="team-section guest-team">
                <div class="team-header">
                    <h2>${game.guestTeamName}</h2>
                    <div class="team-stats">
                        <div class="stat">
                            <div class="stat-label">Score</div>
                            <div class="stat-value">${guestStats.score}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Players</div>
                            <div class="stat-value">${guestStats.players}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Fouls</div>
                            <div class="stat-value">${guestStats.fouls}</div>
                        </div>
                    </div>
                </div>
                
                <div class="players-table">
                    <div class="table-header">
                        <div>#</div>
                        <div>Player</div>
                        <div>PTS</div>
                        <div>FL</div>
                        <div>MIN</div>
                        <div>FG%</div>
                        <div>3PT%</div>
                        <div>FT%</div>
                    </div>
                    ${guestRoster
                .sort((a, b) => {
                    const aStats = guestStats.playerStats[a.name] || { points: 0 };
                    const bStats = guestStats.playerStats[b.name] || { points: 0 };
                    return bStats.points - aStats.points || parseInt(a.number) - parseInt(b.number);
                })
                .map(p => {
                    const stats = guestStats.playerStats[p.name] || {
                        points: 0, fouls: 0, minutes: 0, fgMade: 0, fgAttempted: 0, fgPercentage: 0,
                        threePtMade: 0, threePtAttempted: 0, threePtPercentage: 0,
                        ftMade: 0, ftAttempted: 0, ftPercentage: 0
                    };
                    return `
                        <div class="player-row">
                            <div class="player-number">${p.number}</div>
                            <div>
                                <div class="player-name">${p.name}</div>
                                <div class="player-subtext">${stats.points > 0 || stats.fouls > 0 ? (stats.points > 0 ? stats.points + ' pts' : '') + (stats.points > 0 && stats.fouls > 0 ? ' • ' : '') + (stats.fouls > 0 ? stats.fouls + ' fouls' : '') : (p.isActive ? 'Active' : 'Bench')}</div>
                            </div>
                            <div class="stat-cell" style="color: ${stats.points > 0 ? '#fff' : '#475569'};">${stats.points}</div>
                            <div class="stat-cell" style="color: ${stats.fouls >= 5 ? '#ef4444' : stats.fouls > 0 ? '#94a3b8' : '#475569'};">${stats.fouls}</div>
                            <div class="stat-cell" style="color: ${stats.minutes > 0 ? '#fff' : '#475569'};">${stats.minutes}</div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.fgMade > 0 ? '#fff' : '#475569'};">${stats.fgMade}/${stats.fgAttempted}</div>
                                <div class="shooting-pct">${stats.fgPercentage}%</div>
                            </div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.threePtMade > 0 ? '#fff' : '#475569'};">${stats.threePtMade}/${stats.threePtAttempted}</div>
                                <div class="shooting-pct">${stats.threePtPercentage}%</div>
                            </div>
                            <div class="shooting-cell">
                                <div class="shooting-made" style="color: ${stats.ftMade > 0 ? '#fff' : '#475569'};">${stats.ftMade}/${stats.ftAttempted}</div>
                                <div class="shooting-pct">${stats.ftPercentage}%</div>
                            </div>
                        </div>
                        `}).join('')}
                </div>
            </div>
        </div>
        
        <div class="footer">
            <strong>BBALL SCORER</strong><br>
            Real-time basketball scoring app<br>
            Generated on ${now}
        </div>
    </div>
</body>
</html>`;
    };

    const handleShare = () => {
        const html = generateStandaloneHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${game?.homeTeamName || 'Home'}_vs_${game?.guestTeamName || 'Guest'}_BoxScore.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setShowShareModal(false);
    };

    const handleCopyToClipboard = async () => {
        const html = generateStandaloneHTML();
        await navigator.clipboard.writeText(html);
        alert('HTML copied to clipboard! You can paste it into a file.');
        setShowShareModal(false);
    };

    if (loading || !game) return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-4 sm:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-500 italic text-sm sm:text-base">Loading Box Score...</div>
        </div>
    );

    const homeStats = calculateTeamStats('home');
    const guestStats = calculateTeamStats('guest');

    const homeRoster = game.rosters?.filter(r => r.team === 'home') || [];
    const guestRoster = game.rosters?.filter(r => r.team === 'guest') || [];

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col font-sans overflow-hidden text-white">
            {/* Header */}
            <div className="bg-black/40 border-b border-border p-2 sm:p-4 flex items-center justify-between shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </button>
                <h1 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight">
                    Box Score
                </h1>
                <button
                    onClick={() => setShowShareModal(true)}
                    className="p-2 text-orange-500 hover:text-orange-400 transition-colors"
                >
                    <Share2 size={20} className="sm:w-6 sm:h-6" />
                </button>
            </div>

            {/* Scoreboard */}
            <div className="bg-input/50 p-3 sm:p-4 md:p-6 shrink-0">
                <div className="bg-input border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="text-center flex-1">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-orange-500 truncate">
                                {game.homeTeamName}
                            </div>
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-orange-500 mt-1">
                                {homeStats.score}
                            </div>
                            <div className="text-xs text-orange-500/70 mt-1">{homeStats.fouls} Fouls</div>
                        </div>
                        <div className="px-4 sm:px-8 text-slate-500 font-bold">VS</div>
                        <div className="text-center flex-1">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white truncate">
                                {game.guestTeamName}
                            </div>
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white mt-1">
                                {guestStats.score}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{guestStats.fouls} Fouls</div>
                        </div>
                    </div>
                    <div className="text-center mt-3 text-xs sm:text-sm text-slate-500 uppercase tracking-widest">
                        {game.status === 'final' ? 'Final' : `Period ${game.currentPeriod} of ${game.totalPeriods}`}
                    </div>
                </div>

                {/* Shooting Stats Summary */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Home Team Shooting */}
                    <div className="bg-input/50 border border-orange-500/20 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-orange-500 text-center mb-2 font-bold tracking-wider">Home Shooting</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">FG%</div>
                                <div className="text-sm font-bold text-orange-500">{homeStats.fgMade}/{homeStats.fgAttempted}</div>
                                <div className="text-xs text-orange-500">{homeStats.fgPercentage}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">3PT%</div>
                                <div className="text-sm font-bold text-orange-500">{homeStats.threePtMade}/{homeStats.threePtAttempted}</div>
                                <div className="text-xs text-orange-500">{homeStats.threePtPercentage}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">FT%</div>
                                <div className="text-sm font-bold text-orange-500">{homeStats.ftMade}/{homeStats.ftAttempted}</div>
                                <div className="text-xs text-orange-500">{homeStats.ftPercentage}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Guest Team Shooting */}
                    <div className="bg-input/50 border border-white/10 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-white text-center mb-2 font-bold tracking-wider">Guest Shooting</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">FG%</div>
                                <div className="text-sm font-bold text-white">{guestStats.fgMade}/{guestStats.fgAttempted}</div>
                                <div className="text-xs text-white">{guestStats.fgPercentage}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">3PT%</div>
                                <div className="text-sm font-bold text-white">{guestStats.threePtMade}/{guestStats.threePtAttempted}</div>
                                <div className="text-xs text-white">{guestStats.threePtPercentage}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">FT%</div>
                                <div className="text-sm font-bold text-white">{guestStats.ftMade}/{guestStats.ftAttempted}</div>
                                <div className="text-xs text-white">{guestStats.ftPercentage}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Both Teams - Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
                {/* Home Team Section */}
                <div className="bg-input/50 border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-orange-500/20">
                        <h2 className="text-lg sm:text-xl font-black uppercase text-orange-500">
                            {game.homeTeamName}
                        </h2>
                        <div className="flex gap-4 text-sm">
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Score</div>
                                <div className="font-bold text-orange-500">{homeStats.score}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Players</div>
                                <div className="font-bold">{homeStats.players}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Fouls</div>
                                <div className="font-bold">{homeStats.fouls}</div>
                            </div>
                        </div>
                    </div>

                    {/* Home Players Table */}
                    <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                            <div className="grid grid-cols-[40px_1fr_50px_50px_50px_70px_70px_70px] gap-2 sm:gap-3 px-2 py-2 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border text-center">
                                <div className="text-left">#</div>
                                <div className="text-left">Player</div>
                                <div>PTS</div>
                                <div>FL</div>
                                <div>MIN</div>
                                <div>FG%</div>
                                <div>3PT%</div>
                                <div>FT%</div>
                            </div>
                            {homeRoster
                                .sort((a, b) => {
                                    const aStats = homeStats.playerStats[a.name] || { points: 0 };
                                    const bStats = homeStats.playerStats[b.name] || { points: 0 };
                                    return bStats.points - aStats.points || parseInt(a.number) - parseInt(b.number);
                                })
                                .map((player) => {
                                    const stats = homeStats.playerStats[player.name] || {
                                        points: 0, fouls: 0, minutes: 0, fgMade: 0, fgAttempted: 0, fgPercentage: 0,
                                        threePtMade: 0, threePtAttempted: 0, threePtPercentage: 0,
                                        ftMade: 0, ftAttempted: 0, ftPercentage: 0
                                    };
                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "grid grid-cols-[40px_1fr_50px_50px_50px_70px_70px_70px] gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl items-center text-center",
                                                player.isActive
                                                    ? "bg-orange-500/10 border border-orange-500/20"
                                                    : "bg-input/30 border border-border/50 opacity-60"
                                            )}
                                        >
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-black text-sm sm:text-base bg-orange-500/20 text-orange-500">
                                                {player.number}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <div className="font-bold text-sm sm:text-base truncate">
                                                    {player.name}
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-slate-500">
                                                    {player.isActive ? 'Active' : 'Bench'}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "text-base sm:text-lg font-black",
                                                stats.points > 0 ? "text-orange-500" : "text-slate-600"
                                            )}>
                                                {stats.points}
                                            </div>
                                            <div className={cn(
                                                "text-base sm:text-lg font-black",
                                                stats.fouls >= 5 ? "text-red-500" : stats.fouls > 0 ? "text-slate-300" : "text-slate-600"
                                            )}>
                                                {stats.fouls}
                                            </div>
                                            <div className={cn(
                                                "text-sm sm:text-base font-bold",
                                                stats.minutes > 0 ? "text-orange-500" : "text-slate-600"
                                            )}>
                                                {stats.minutes}
                                            </div>
                                            {/* FG% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.fgMade > 0 ? "text-orange-500" : "text-slate-600"
                                                )}>
                                                    {stats.fgMade}/{stats.fgAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.fgPercentage}%</div>
                                            </div>
                                            {/* 3PT% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.threePtMade > 0 ? "text-orange-500" : "text-slate-600"
                                                )}>
                                                    {stats.threePtMade}/{stats.threePtAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.threePtPercentage}%</div>
                                            </div>
                                            {/* FT% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.ftMade > 0 ? "text-orange-500" : "text-slate-600"
                                                )}>
                                                    {stats.ftMade}/{stats.ftAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.ftPercentage}%</div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                        </div>
                    </div>
                </div>

                {/* Guest Team Section */}
                <div className="bg-input/50 border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-white/10">
                        <h2 className="text-lg sm:text-xl font-black uppercase text-white">
                            {game.guestTeamName}
                        </h2>
                        <div className="flex gap-4 text-sm">
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Score</div>
                                <div className="font-bold text-white">{guestStats.score}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Players</div>
                                <div className="font-bold">{guestStats.players}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-500">Fouls</div>
                                <div className="font-bold">{guestStats.fouls}</div>
                            </div>
                        </div>
                    </div>

                    {/* Guest Players Table */}
                    <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                            <div className="grid grid-cols-[40px_1fr_50px_50px_50px_70px_70px_70px] gap-2 sm:gap-3 px-2 py-2 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border text-center">
                                <div className="text-left">#</div>
                                <div className="text-left">Player</div>
                                <div>PTS</div>
                                <div>FL</div>
                                <div>MIN</div>
                                <div>FG%</div>
                                <div>3PT%</div>
                                <div>FT%</div>
                            </div>
                            {guestRoster
                                .sort((a, b) => {
                                    const aStats = guestStats.playerStats[a.name] || { points: 0 };
                                    const bStats = guestStats.playerStats[b.name] || { points: 0 };
                                    return bStats.points - aStats.points || parseInt(a.number) - parseInt(b.number);
                                })
                                .map((player) => {
                                    const stats = guestStats.playerStats[player.name] || {
                                        points: 0, fouls: 0, minutes: 0, fgMade: 0, fgAttempted: 0, fgPercentage: 0,
                                        threePtMade: 0, threePtAttempted: 0, threePtPercentage: 0,
                                        ftMade: 0, ftAttempted: 0, ftPercentage: 0
                                    };
                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "grid grid-cols-[40px_1fr_50px_50px_50px_70px_70px_70px] gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl items-center text-center",
                                                player.isActive
                                                    ? "bg-white/5 border border-white/10"
                                                    : "bg-input/30 border border-border/50 opacity-60"
                                            )}
                                        >
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-black text-sm sm:text-base bg-card text-slate-400">
                                                {player.number}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <div className="font-bold text-sm sm:text-base truncate">
                                                    {player.name}
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-slate-500">
                                                    {player.isActive ? 'Active' : 'Bench'}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "text-base sm:text-lg font-black",
                                                stats.points > 0 ? "text-white" : "text-slate-600"
                                            )}>
                                                {stats.points}
                                            </div>
                                            <div className={cn(
                                                "text-base sm:text-lg font-black",
                                                stats.fouls >= 5 ? "text-red-500" : stats.fouls > 0 ? "text-slate-300" : "text-slate-600"
                                            )}>
                                                {stats.fouls}
                                            </div>
                                            <div className={cn(
                                                "text-sm sm:text-base font-bold",
                                                stats.minutes > 0 ? "text-white" : "text-slate-600"
                                            )}>
                                                {stats.minutes}
                                            </div>
                                            {/* FG% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.fgMade > 0 ? "text-white" : "text-slate-600"
                                                )}>
                                                    {stats.fgMade}/{stats.fgAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.fgPercentage}%</div>
                                            </div>
                                            {/* 3PT% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.threePtMade > 0 ? "text-white" : "text-slate-600"
                                                )}>
                                                    {stats.threePtMade}/{stats.threePtAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.threePtPercentage}%</div>
                                            </div>
                                            {/* FT% */}
                                            <div className="text-center">
                                                <div className={cn(
                                                    "text-sm font-bold",
                                                    stats.ftMade > 0 ? "text-white" : "text-slate-600"
                                                )}>
                                                    {stats.ftMade}/{stats.ftAttempted}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{stats.ftPercentage}%</div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-input border border-border rounded-2xl p-6 max-w-sm w-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Share Box Score</h2>
                            <button onClick={() => setShowShareModal(false)}>
                                <X size={24} className="text-slate-500 hover:text-white" />
                            </button>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">
                            Download the box score as an HTML file that can be shared via email, messaging apps, or saved to your phone.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={handleShare}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                            >
                                <Download size={20} />
                                Download HTML File
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                className="w-full bg-card hover:bg-muted text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                            >
                                <Share2 size={20} />
                                Copy HTML to Clipboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Info (Hidden in print/share) */}
            <div className="text-[10px] text-slate-800 text-center p-2 opacity-50 hover:opacity-100 transition-opacity">
                {game?.events?.length || 0} events • {Object.keys(homeStats.playerStats).length + Object.keys(guestStats.playerStats).length} players tracked
            </div>
        </div>
    );
}
