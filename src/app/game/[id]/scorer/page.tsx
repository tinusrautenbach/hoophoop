'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@/components/auth-provider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, Users, ArrowLeft, ShieldAlert,
    Share2, QrCode, Copy, Check, X,
    Home, Flag, Table, Eye, Globe, Users2, Settings, Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SimpleScorer } from '@/components/scorer/simple-scorer';
import { AdvancedScorer } from '@/components/scorer/advanced-scorer';
import { BenchSelection } from '@/components/scorer/bench-selection';
import { ScoringModal } from '@/components/scorer/scoring-modal';
import { SubsModal } from '@/components/scorer/subs-modal';
import { AmendRosterModal } from '@/components/scorer/amend-roster-modal';
import { GameLog, type GameEvent } from '@/components/scorer/game-log';
import { ScorerManager } from '@/components/scorer/scorer-manager';
import { GameSettingsModal } from '@/components/scorer/game-settings-modal';
import QRCode from 'react-qr-code';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    points: number;
    fouls: number;
    isActive: boolean;
};

type GameEventRaw = {
    id: string;
    type: string;
    team: 'home' | 'guest';
    createdAt?: string;
    timestamp?: string;
};

type Scorer = {
    id: string;
    userId: string;
    role: 'owner' | 'co_scorer' | 'viewer';
    joinedAt: string;
};



type Game = {
    id: string;
    ownerId: string;
    name: string | null;
    scheduledDate: string | null;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    currentPeriod: number;
    totalPeriods: number;
    periodSeconds: number;
    clockSeconds: number;
    homeTimeouts: number;
    guestTimeouts: number;
    totalTimeouts: number;
    possession: 'home' | 'guest' | null;
    mode: 'simple' | 'advanced';
    visibility: 'private' | 'public_general' | 'public_community';
    status: 'scheduled' | 'live' | 'final';
    isTimerRunning: boolean;
    rosters: RosterEntry[];
    scorers?: Scorer[];
    communityId?: string | null;
    community?: {
        id: string;
        name: string;
        ownerId: string;
        members?: { userId: string; role: string }[];
    } | null;
};

export default function ScorerPage() {
    const { id } = useParams();
    const router = useRouter();
    const { socket, isConnected } = useSocket(id as string);
    const { userId } = useAuth();

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [scoringFor, setScoringFor] = useState<{ points: number, side?: 'home' | 'guest', isMiss?: boolean } | null>(null);
    // isTimerRunning is now derived from game state, but we keep local state for optimistic UI
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isSubsOpen, setIsSubsOpen] = useState(false);
    const [isTimeEditing, setIsTimeEditing] = useState(false);
    const [tempTime, setTempTime] = useState<{ min: string, sec: string }>({ min: '10', sec: '00' });
    const [events, setEvents] = useState<GameEvent[]>([]);
    const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
    const [foulingFor, setFoulingFor] = useState<'home' | 'guest' | null>(null);
    const [isTimeoutOpen, setIsTimeoutOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isScorersOpen, setIsScorersOpen] = useState(false);
    const [isAmendRosterOpen, setIsAmendRosterOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isEndGameOpen, setIsEndGameOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [scorers, setScorers] = useState<Scorer[]>([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (userId && socket) {
            socket.emit('authenticate', { userId });
        }
    }, [userId, socket]);

    useEffect(() => {
        fetch(`/api/games/${id}`)
            .then(res => res.json())
            .then(data => {
                setGame(data);
                setIsTimerRunning(data.isTimerRunning);
                if (data.events) {
                    setEvents(data.events.map((e: GameEventRaw) => ({
                        ...e,
                        timestamp: new Date(e.createdAt || e.timestamp || Date.now())
                    })) as GameEvent[]);
                }
                if (data.scorers) {
                    setScorers(data.scorers);
                }
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!socket) return;

        // Listen for full game state on connection
        const handleGameState = ({ game: gameState, events: gameEvents }: { game: Game, events: GameEventRaw[] }) => {
            console.log('Scorer received game-state:', gameState);
            setGame(gameState);
            setIsTimerRunning(gameState.isTimerRunning);
            if (gameState.scorers) {
                setScorers(gameState.scorers);
            }
            if (gameEvents) {
                setEvents(gameEvents.map((e: GameEventRaw) => ({
                    ...e,
                    timestamp: new Date(e.timestamp || e.createdAt || Date.now())
                })) as GameEvent[]);
            }
        };

        const handleClockUpdate = (data: { gameId: string, clockSeconds: number, isTimerRunning: boolean }) => {
            if (data.gameId === id) {
                setGame(prev => prev ? { ...prev, clockSeconds: data.clockSeconds } : null);
                setIsTimerRunning(data.isTimerRunning);
            }
        };

        const handleTimerStarted = (data: { gameId: string, clockSeconds: number }) => {
            if (data.gameId === id) {
                setIsTimerRunning(true);
                setGame(prev => prev ? { ...prev, clockSeconds: data.clockSeconds } : null);
            }
        };

        const handleTimerStopped = (data: { gameId: string, clockSeconds: number }) => {
            if (data.gameId === id) {
                setIsTimerRunning(false);
                setGame(prev => prev ? { ...prev, clockSeconds: data.clockSeconds } : null);
            }
        };

        socket.on('game-state', handleGameState);
        socket.on('clock-update', handleClockUpdate);
        socket.on('timer-started', handleTimerStarted);
        socket.on('timer-stopped', handleTimerStopped);

        socket.on('game-updated', (updates: Partial<Game> & { deleteEventId?: string }) => {
            if (updates.deleteEventId) {
                setEvents(prev => prev.filter(e => e.id !== updates.deleteEventId));
            }
            setGame(prev => prev ? { ...prev, ...updates } : null);
        });
        socket.on('event-added', (event: GameEvent) => {
            // Convert string timestamp back to Date if needed
            const newEvent = {
                ...event,
                timestamp: new Date(event.timestamp)
            };
            setEvents(prev => [newEvent, ...prev]);
        });

        // Emit join-game AFTER setting up listeners to avoid race condition
        if (socket.connected) {
            console.log('Scorer emitting join-game for:', id);
            socket.emit('join-game', id);
        }

        // Handle reconnection - re-join game room when socket reconnects
        const handleConnect = () => {
            console.log('[Scorer] Socket reconnected, re-joining game:', id);
            socket.emit('join-game', id);
        };
        socket.on('connect', handleConnect);

        return () => {
            socket.off('game-state', handleGameState);
            socket.off('clock-update', handleClockUpdate);
            socket.off('timer-started', handleTimerStarted);
            socket.off('timer-stopped', handleTimerStopped);
            socket.off('game-updated');
            socket.off('event-added');
            socket.off('connect', handleConnect);
        };
    }, [socket, id]);

    // We no longer need local timer ticking or periodic sync in the Scorer
    // The server is now the authority.

    const toggleTimer = () => {
        if (!game || !socket || !userId) return;
        
        const action = isTimerRunning ? 'stop' : 'start';
        const previousState = isTimerRunning;
        
        // Optimistic update
        setIsTimerRunning(!isTimerRunning);
        
        // Emit with acknowledgment callback for error handling
        socket.emit('timer-control', {
            gameId: id,
            action,
            userId
        }, (response: { success: boolean; error?: string; clockSeconds?: number; isTimerRunning?: boolean }) => {
            if (!response?.success) {
                // Revert optimistic update on failure
                console.error(`[Timer] Failed to ${action} timer:`, response?.error);
                setIsTimerRunning(previousState);
                // Optionally show error to user (could add toast notification here)
            } else {
                // Confirm state matches server
                if (response.isTimerRunning !== undefined) {
                    setIsTimerRunning(response.isTimerRunning);
                }
                if (response.clockSeconds !== undefined) {
                    setGame(prev => prev ? { ...prev, clockSeconds: response.clockSeconds! } : null);
                }
            }
        });
    };

    const handleAddScorer = async (userIdToAdd: string) => {
        try {
            const res = await fetch(`/api/games/${id}/scorers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userIdToAdd }),
            });
            
            if (res.ok) {
                const newScorer = await res.json();
                setScorers(prev => [...prev, newScorer]);
                // Could emit socket event here to notify other scorers
            } else {
                console.error('Failed to add scorer');
            }
        } catch (error) {
            console.error('Error adding scorer:', error);
        }
    };

    const handleRemoveScorer = async (scorerId: string) => {
        try {
            const res = await fetch(`/api/games/${id}/scorers/${scorerId}`, {
                method: 'DELETE',
            });
            
            if (res.ok) {
                setScorers(prev => prev.filter(s => s.id !== scorerId));
            } else {
                console.error('Failed to remove scorer');
            }
        } catch (error) {
            console.error('Error removing scorer:', error);
        }
    };

    const handleScore = (points: number, side?: 'home' | 'guest', isMiss = false) => {
        setScoringFor({ points, side, isMiss });
    };

    const addEvent = async (event: Omit<GameEvent, 'id' | 'timestamp'>) => {
        try {
            const res = await fetch(`/api/games/${id}/events`, {
                method: 'POST',
                body: JSON.stringify({
                    ...event,
                    clockAt: game?.clockSeconds,
                    period: game?.currentPeriod
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const persistedEvent = await res.json();
                const newEvent: GameEvent = {
                    ...persistedEvent,
                    timestamp: new Date(persistedEvent.createdAt)
                };
                setEvents(prev => [newEvent, ...prev]);
                socket?.emit('add-event', { gameId: id, event: newEvent });
            }
        } catch (error) {
            console.error('Failed to save event:', error);
        }
    };

    const deleteEvent = async (eventId: string) => {
        try {
            const res = await fetch(`/api/games/${id}/events?eventId=${eventId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                const data = await res.json();
                setEvents(prev => prev.filter(e => e.id !== eventId));
                
                // If the server returned updated game state (scores/fouls), update local state
                // and broadcast it along with the deletion signal
                const updates: Partial<Game> & { deleteEventId: string } = { deleteEventId: eventId };
                
                if (data.game) {
                    setGame(prev => prev ? { ...prev, ...data.game } : null);
                    Object.assign(updates, data.game);
                }

                socket?.emit('update-game', {
                    gameId: id,
                    updates
                });
            }
        } catch (error) {
            console.error('Failed to delete event:', error);
        }
    };

    const handleSaveEdit = (updatedEvent: GameEvent) => {
        if (!game || !editingEvent) return;

        let { homeScore, guestScore, homeFouls, guestFouls, rosters } = game;

        // 1. Revert Old Event Effects
        if (editingEvent.type === 'score' && editingEvent.value) {
            if (editingEvent.team === 'home') homeScore -= editingEvent.value;
            else guestScore -= editingEvent.value;

            rosters = rosters.map(r =>
                r.name === editingEvent.player ? { ...r, points: r.points - (editingEvent.value || 0) } : r
            );
        } else if (editingEvent.type === 'foul') {
            if (editingEvent.team === 'home') {
                homeFouls = Math.max(0, homeFouls - 1);
                rosters = rosters.map(r => r.name === editingEvent.player ? { ...r, fouls: r.fouls - 1 } : r);
            } else {
                guestFouls = Math.max(0, guestFouls - 1);
                rosters = rosters.map(r => r.name === editingEvent.player ? { ...r, fouls: r.fouls - 1 } : r);
            }
        }

        // 2. Apply New Event Effects
        if (updatedEvent.type === 'score' && updatedEvent.value) {
            if (updatedEvent.team === 'home') homeScore += updatedEvent.value;
            else guestScore += updatedEvent.value;

            rosters = rosters.map(r =>
                r.name === updatedEvent.player ? { ...r, points: r.points + (updatedEvent.value || 0) } : r
            );
        } else if (updatedEvent.type === 'foul') {
            if (updatedEvent.team === 'home') {
                homeFouls += 1;
                rosters = rosters.map(r => r.name === updatedEvent.player ? { ...r, fouls: r.fouls + 1 } : r);
            } else {
                guestFouls += 1;
                rosters = rosters.map(r => r.name === updatedEvent.player ? { ...r, fouls: r.fouls + 1 } : r);
            }
        }

        // 3. Update States
        updateGame({
            homeScore,
            guestScore,
            homeFouls,
            guestFouls,
            rosters
        });

        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));

        // Broadcast Event Update
        socket?.emit('update-game', {
            gameId: id,
            updates: { updatedEvent }
        });

        // Persist Event Update to DB
        fetch(`/api/games/${id}/events`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedEvent)
        }).catch(err => console.error('Failed to persist event update:', err));

        setEditingEvent(null);
    };

    const handlePlayerScore = (rosterEntryId: string) => {
        if (!scoringFor || !game) return;

        const player = game.rosters.find(r => r.id === rosterEntryId);
        if (!player) return;

        const shotType = scoringFor.points === 1 ? 'ft' : scoringFor.points === 3 ? '3pt' : '2pt';

        if (scoringFor.isMiss) {
            addEvent({
                type: 'miss',
                team: player.team,
                player: player.name,
                value: scoringFor.points,
                metadata: { shotType },
                description: `${player.name} Missed ${scoringFor.points === 1 ? 'Free Throw' : scoringFor.points === 3 ? '3PT' : 'FG'}`
            });
            setScoringFor(null);
            return;
        }

        const updatedRosters = game.rosters.map(r =>
            r.id === rosterEntryId ? { ...r, points: r.points + scoringFor.points } : r
        );

        const scoreUpdate = player.team === 'home'
            ? { homeScore: game.homeScore + scoringFor.points }
            : { guestScore: game.guestScore + scoringFor.points };

        updateGame({
            ...scoreUpdate,
            rosters: updatedRosters
        });

        addEvent({
            type: 'score',
            team: player.team,
            player: player.name,
            value: scoringFor.points,
            metadata: { shotType, points: scoringFor.points },
        });

        setScoringFor(null);
    };

    const handleFoul = (side: 'home' | 'guest') => {
        setFoulingFor(side);
    };

    const handlePlayerFoul = (rosterEntryId: string) => {
        if (!foulingFor || !game) return;

        const player = game.rosters.find(r => r.id === rosterEntryId);
        if (!player) return;

        const updatedRosters = game.rosters.map(r =>
            r.id === rosterEntryId ? { ...r, fouls: r.fouls + 1 } : r
        );

        const foulUpdate = foulingFor === 'home'
            ? { homeFouls: game.homeFouls + 1 }
            : { guestFouls: game.guestFouls + 1 };

        updateGame({
            ...foulUpdate,
            rosters: updatedRosters
        });

        addEvent({
            type: 'foul',
            team: foulingFor,
            player: player.name,
        });

        setFoulingFor(null);
    };

    const handleTimeout = (side?: 'home' | 'guest') => {
        if (!game) return;
        if (!side) {
            setIsTimeoutOpen(true);
            return;
        }

        const currentAvailable = game[side === 'home' ? 'homeTimeouts' : 'guestTimeouts'];
        if (currentAvailable <= 0) return;

        const updates = side === 'home'
            ? { homeTimeouts: game.homeTimeouts - 1 }
            : { guestTimeouts: game.guestTimeouts - 1 };

        updateGame(updates);
        addEvent({
            type: 'timeout',
            team: side,
            description: `${side === 'home' ? game.homeTeamName : game.guestTeamName} Timeout`,
        });

        // Auto-stop timer on timeout
        if (isTimerRunning) {
            // Send stop command to server
            socket?.emit('timer-control', {
                gameId: id,
                action: 'stop',
                userId
            });
            setIsTimerRunning(false);
        }
        setIsTimeoutOpen(false);
    };

    const handleSub = () => {
        setIsSubsOpen(true);
    };

    const nextPeriod = () => {
        if (!game) return;
        // Allow unlimited periods for OT

        updateGame({
            currentPeriod: game.currentPeriod + 1,
            homeFouls: 0,
            guestFouls: 0,
            clockSeconds: game.periodSeconds || 600,
        });

        // Log period start event
        addEvent({
            type: 'period_start',
            team: 'home', // defaulting to home for system event owner
            player: 'System',
            value: 0,
            description: `Start of Period ${game.currentPeriod + 1}`,
            period: game.currentPeriod + 1,
            clockAt: game.periodSeconds || 600
        });

        // Ensure timer is stopped on server
        if (isTimerRunning) {
            socket?.emit('timer-control', {
                gameId: id,
                action: 'stop',
                userId
            });
            setIsTimerRunning(false);
        }
    };

    const handleEndGame = () => {
        if (!game) return;
        
        // Stop timer if running
        if (isTimerRunning) {
            socket?.emit('timer-control', {
                gameId: id,
                action: 'stop',
                userId
            });
            setIsTimerRunning(false);
        }
        
        // Update game status to final
        updateGame({
            status: 'final'
        });
        
        // Add end game event
        addEvent({
            type: 'game_end',
            team: 'home',
            player: 'System',
            description: `Game Ended - Final Score: ${game.homeScore}-${game.guestScore}`,
        });
        
        setIsEndGameOpen(false);
    };

    const handleAddRosterPlayer = async (player: { name: string, number: string, team: 'home' | 'guest' }) => {
        try {
            const res = await fetch(`/api/games/${id}/roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(player)
            });
            if (res.ok) {
                const newPlayer = await res.json();
                // Optimistically update or wait for socket? 
                // Socket update usually comes from 'game-updated' but creating roster entry might not trigger it unless backend does.
                // The API I wrote DOES insert an event, but doesn't explicitly broadcast 'game-updated' with new roster list.
                // However, I should probably trigger a game reload or manual update.
                // For now, let's update local state manually to feel responsive.
                setGame(prev => prev ? {
                    ...prev,
                    rosters: [...prev.rosters, { ...newPlayer, points: 0, fouls: 0, isActive: false }]
                } : null);
                
                // Also need to broadcast this change via socket if backend doesn't.
                // Ideally backend should broadcast. My API implementation didn't emit socket events.
                // I should assume the `game-updated` event might not fire for roster ADDITION unless I added that logic.
                // But creating an EVENT (sub) usually triggers 'event-added'.
                
                // Let's emit a signal to refresh game state or just broadcast the roster change manually?
                // Simpler: Just rely on local update and maybe socket 'game-updated' if I implement it in API.
                // Since I didn't implement socket emit in the API route (it's serverless/next api route, hard to get socket.io instance directly without a separate server component or using the global io if initialized).
                // Actually `server.ts` initializes io. Using it in Next.js API routes is tricky.
                // So client-side emit is often easier for immediate feedback if security allows.
                
                socket?.emit('update-game', {
                    gameId: id,
                    updates: { 
                        // Force a re-fetch or just send the new roster list?
                        // Sending the whole roster list is heavy but safe.
                        rosters: [...(game?.rosters || []), { ...newPlayer, points: 0, fouls: 0, isActive: false }]
                    }
                });
            }
        } catch (error) {
            console.error('Failed to add player:', error);
        }
    };

    const handleUpdateRosterPlayer = async (rosterId: string, updates: { number?: string, name?: string }) => {
        try {
            const res = await fetch(`/api/games/${id}/roster`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: rosterId, ...updates })
            });
            if (res.ok) {
                const updatedPlayer = await res.json();
                const newRosters = game?.rosters.map(r => r.id === rosterId ? { ...r, ...updatedPlayer } : r) || [];
                setGame(prev => prev ? { ...prev, rosters: newRosters } : null);
                
                socket?.emit('update-game', {
                    gameId: id,
                    updates: { rosters: newRosters }
                });
            }
        } catch (error) {
            console.error('Failed to update player:', error);
        }
    };

    const handleRemoveRosterPlayer = async (rosterId: string) => {
        try {
            const res = await fetch(`/api/games/${id}/roster?rosterId=${rosterId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                const newRosters = game?.rosters.filter(r => r.id !== rosterId) || [];
                setGame(prev => prev ? { ...prev, rosters: newRosters } : null);
                
                socket?.emit('update-game', {
                    gameId: id,
                    updates: { rosters: newRosters }
                });
            }
        } catch (error) {
            console.error('Failed to remove player:', error);
        }
    };

    const updateGame = (updates: Partial<Game> & { isTimerRunning?: boolean }) => {
        if (!socket || !game) return;
        const newState = { ...game, ...updates };
        setGame(newState);
        socket.emit('update-game', { gameId: id, updates });

        // Persist to DB - now includes isTimerRunning
        if (Object.keys(updates).length > 0) {
            fetch(`/api/games/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            }).catch(err => console.error('Failed to persist game update:', err));
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSaveSettings = async (settings: Partial<Game>) => {
        if (!game) return;
        setIsSavingSettings(true);
        try {
            console.log('Saving settings:', settings);
            
            const res = await fetch(`/api/games/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            
            if (res.ok) {
                updateGame(settings);
                setIsSettingsOpen(false);
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to save settings:', errorData);
                alert(`Failed to save settings: ${errorData.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert('Failed to save settings: Network error');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleStartGame = (updatedRosters: RosterEntry[]) => {
        if (!game) return;
        updateGame({
            rosters: updatedRosters,
            status: 'live'
        });
    };

    // Check if current user can edit game settings (game owner, community owner, community admin, or world admin)
    // Note: World admin status is checked on the API side
    const canEditSettings = () => {
        if (!game || !userId) return false;
        // Always allow the button to show - API will enforce world admin permissions
        // This covers: game owner, community owner, community admin, and world admin (enforced by API)
        return true;
    };

    // Check if current user can delete this game
    const canDeleteGame = () => {
        if (!game || !userId) return false;
        const canDeleteGameOwner = game.ownerId === userId;
        const canDeleteCommunityOwner = game.community?.ownerId === userId;
        const canDeleteCommunityAdmin = game.community?.members?.some(
            m => m.userId === userId && m.role === 'admin'
        );
        return canDeleteGameOwner || canDeleteCommunityOwner || canDeleteCommunityAdmin;
    };

    const handleDeleteGame = async () => {
        if (!canDeleteGame()) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/games/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                router.push('/games');
            } else {
                console.error('Failed to delete game');
                alert('Failed to delete game');
            }
        } catch (err) {
            console.error('Failed to delete game:', err);
            alert('Failed to delete game');
        } finally {
            setIsDeleting(false);
            setIsDeleteConfirmOpen(false);
        }
    };

    if (loading || !game) return <div className="p-8 text-center text-slate-500 italic">Entering Arena...</div>;

    if (game.status === 'scheduled') {
        return (
            <BenchSelection 
                game={game} 
                onStartGame={handleStartGame}
                onCancel={() => router.push('/games')}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col font-sans select-none touch-none overflow-hidden">
            {/* Top Header - THE DISPLAY */}
            <div className="bg-black/40 border-b border-border p-2 landscape:p-1 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                    <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-white landscape:p-1">
                        <ArrowLeft size={20} />
                    </button>
                    <button 
                        onClick={() => router.push('/games')} 
                        className="p-2 text-slate-500 hover:text-orange-500 transition-colors landscape:p-1"
                        title="Back to Main Menu"
                    >
                        <Home size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-4 landscape:gap-8">
                    {/* Home Score (Landscape only) */}
                    <div className="hidden landscape:flex flex-col items-center">
                        <div className="text-[8px] font-black uppercase text-orange-500/60 leading-none mb-1">{game.homeTeamName}</div>
                        <div className="text-3xl font-black font-mono leading-none">{game.homeScore}</div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 mb-0.5">
                            <button
                                onClick={nextPeriod}
                                className="text-[10px] landscape:text-[8px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1 hover:text-white transition-colors"
                            >
                                <div className={cn("w-2 h-2 landscape:w-1.5 landscape:h-1.5 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
                                P{game.currentPeriod}
                            </button>
                            {/* Visibility Badge */}
                            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                game.visibility === 'private' ? 'bg-card text-slate-500' :
                                game.visibility === 'public_general' ? 'bg-green-500/20 text-green-500' :
                                'bg-blue-500/20 text-blue-500'
                            }`}>
                                {game.visibility === 'private' ? <Eye size={8} /> :
                                 game.visibility === 'public_general' ? <Globe size={8} /> :
                                 <Users2 size={8} />}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const mins = Math.floor(game.clockSeconds / 60);
                                const secs = game.clockSeconds % 60;
                                setTempTime({ min: mins.toString(), sec: secs.toString().padStart(2, '0') });
                                setIsTimeEditing(true);
                            }}
                            className="font-mono text-4xl landscape:text-3xl text-orange-500 tracking-tighter leading-none hover:text-white transition-colors"
                        >
                            {formatTime(game.clockSeconds)}
                        </button>
                    </div>

                    {/* Guest Score (Landscape only) */}
                    <div className="hidden landscape:flex flex-col items-center">
                        <div className="text-[8px] font-black uppercase text-slate-500 leading-none mb-1">{game.guestTeamName}</div>
                        <div className="text-3xl font-black font-mono leading-none">{game.guestScore}</div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Settings - Owner only */}
                    {canEditSettings() && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-slate-500 hover:text-orange-500 transition-colors landscape:p-1"
                            title="Game Settings"
                        >
                            <Settings size={18} />
                        </button>
                    )}
                    {/* Multi-Scorer Presence Indicator */}
                    <button
                        onClick={() => setIsScorersOpen(true)}
                        className="p-2 text-slate-500 hover:text-white landscape:p-1 relative"
                        title="Manage Scorers"
                    >
                        <Users size={18} className={cn(scorers.length > 0 && "text-blue-500")} />
                        {scorers.length > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-black" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="p-2 text-slate-500 hover:text-orange-500 transition-colors landscape:p-1"
                        title="Share Scoreboard"
                    >
                        <QrCode size={18} />
                    </button>
                    {/* Delete Game Button (Owner/Admin only) */}
                    {canDeleteGame() && (
                        <button
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="p-2 text-slate-500 hover:text-red-500 transition-colors landscape:p-1"
                            title="Delete Game"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>


            {/* Main Content Area */}
            <div className="flex-1 flex flex-col landscape:flex-row overflow-hidden">
                {/* PORTRAIT VIEW */}
                <div className="flex flex-col flex-1 landscape:hidden overflow-hidden">
                    {/* Main Scoring Area */}
                    <div className="flex-1 overflow-y-auto">
                        {game.mode === 'advanced' ? (
                            <AdvancedScorer
                                game={game}
                                updateGame={updateGame}
                                handleScore={handleScore}
                                addEvent={addEvent}
                            />
                        ) : (
                            <SimpleScorer
                                game={game}
                                handleScore={handleScore}
                                handleFoul={handleFoul}
                            />
                        )}
                    </div>

                    {/* Game Log - Scrollable at Bottom */}
                    <div className="px-4 py-2 border-t border-white/5 bg-input/40">
                        <GameLog
                            events={events}
                            limit={5}
                            onHeaderClick={() => router.push(`/game/${id}/scorer/log`)}
                            onDelete={deleteEvent}
                            onEdit={(id) => setEditingEvent(events.find(e => e.id === id) || null)}
                        />
                    </div>

                    {/* Bottom Controls (Portrait) */}
                    <div className="h-20 bg-input border-t border-border grid grid-cols-4 gap-1 p-1 shrink-0">
                        <button
                            onClick={() => handleTimeout()}
                            className="bg-card/50 rounded-xl font-bold text-[10px] uppercase text-slate-400 flex flex-col items-center justify-center hover:bg-card transition-colors"
                        >
                            <div className="flex gap-1 mb-1">
                                {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                    <div key={i} className={cn("w-3 h-1 rounded-full", i < game.homeTimeouts ? "bg-orange-500" : "bg-muted")} />
                                ))}
                            </div>
                            Timeouts
                        </button>
                        <button
                            onClick={toggleTimer}
                            className={cn(
                                "rounded-xl font-black text-xl flex flex-col items-center justify-center transition-all",
                                isTimerRunning ? "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]" : "bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Clock fill="currentColor" size={20} className={cn(isTimerRunning && "animate-pulse")} />
                                <span className="text-sm">{isTimerRunning ? 'STOP' : 'START'}</span>
                            </div>
                        </button>
                        <button
                            onClick={handleSub}
                            className="bg-card/50 rounded-xl font-bold text-[10px] uppercase text-slate-400 flex flex-col items-center justify-center hover:bg-card transition-colors"
                        >
                            <Users size={16} className="mb-1" />
                            Subs
                        </button>
                        <button
                            onClick={() => router.push(`/game/${id}/box-score`)}
                            className="bg-card/50 rounded-xl font-bold text-[10px] uppercase text-slate-400 flex flex-col items-center justify-center hover:bg-card transition-colors"
                        >
                            <Table size={16} className="mb-1" />
                            Box Score
                        </button>
                    </div>
                </div>

                {/* LANDSCAPE VIEW (3 Columns) */}
                <div className="hidden landscape:grid grid-cols-[1fr_1.5fr_1fr] flex-1 overflow-hidden p-2 gap-2">
                    {/* LEFT THIRD: SCORING */}
                    <div className="grid grid-rows-3 gap-2 h-full">
                        <div className="grid grid-cols-[1fr_0.6fr] gap-2">
                            <button
                                onClick={() => handleScore(3)}
                                className="bg-orange-600/10 border border-orange-500/20 rounded-2xl flex flex-col items-center justify-center hover:bg-orange-600/20 active:scale-95 transition-all group"
                            >
                                <span className="text-4xl font-black text-orange-500 group-hover:scale-110 transition-transform">+3</span>
                                <span className="text-[8px] uppercase font-black tracking-[0.2em] text-orange-500/50">Three Pointer</span>
                            </button>
                            <button
                                onClick={() => handleScore(3, undefined, true)}
                                className="bg-input border border-border rounded-2xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all group opacity-60 hover:opacity-100"
                            >
                                <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-3</span>
                                <span className="text-[7px] uppercase font-black tracking-widest text-slate-600">Miss</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-[1fr_0.6fr] gap-2">
                            <button
                                onClick={() => handleScore(2)}
                                className="bg-input border border-border rounded-2xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all group"
                            >
                                <span className="text-4xl font-black text-slate-200 group-hover:scale-110 transition-transform">+2</span>
                                <span className="text-[8px] uppercase font-black tracking-[0.2em] text-slate-500">Field Goal</span>
                            </button>
                            <button
                                onClick={() => handleScore(2, undefined, true)}
                                className="bg-input border border-border rounded-2xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all group opacity-60 hover:opacity-100"
                            >
                                <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-2</span>
                                <span className="text-[7px] uppercase font-black tracking-widest text-slate-600">Miss</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-[1fr_0.6fr] gap-2">
                            <button
                                onClick={() => handleScore(1)}
                                className="bg-input/50 border border-border rounded-2xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all group"
                            >
                                <span className="text-3xl font-black text-slate-400 group-hover:scale-110 transition-transform">+1</span>
                                <span className="text-[8px] uppercase font-black tracking-[0.2em] text-slate-600">Free Throw</span>
                            </button>
                            <button
                                onClick={() => handleScore(1, undefined, true)}
                                className="bg-input border border-border rounded-2xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all group opacity-60 hover:opacity-100"
                            >
                                <span className="text-2xl font-black text-slate-500 group-hover:scale-110 transition-transform">-1</span>
                                <span className="text-[7px] uppercase font-black tracking-widest text-slate-600">Miss</span>
                            </button>
                        </div>
                    </div>

                    {/* MIDDLE THIRD: GAME LOG */}
                    <div className="flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            <GameLog
                                events={events}
                                limit={10}
                                onHeaderClick={() => router.push(`/game/${id}/scorer/log`)}
                                onDelete={deleteEvent}
                                onEdit={(id) => setEditingEvent(events.find(e => e.id === id) || null)}
                            />
                        </div>
                    </div>

                    {/* RIGHT THIRD: FOULS / SUBS / TIMER */}
                    <div className="flex flex-col gap-2 h-full">
                        {/* Fouls Split */}
                        <div className="grid grid-cols-2 gap-2 flex-1">
                            <button
                                onClick={() => handleFoul('home')}
                                className="bg-red-950/20 border border-red-500/20 rounded-xl flex flex-col items-center justify-center hover:bg-red-900/40 active:scale-95 transition-all"
                            >
                                <span className="text-[9px] font-black uppercase text-red-500">Home Foul</span>
                                <div className="text-xs font-mono font-black text-red-400">{game.homeFouls}</div>
                            </button>
                            <button
                                onClick={() => handleFoul('guest')}
                                className="bg-input border border-border rounded-xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all"
                            >
                                <span className="text-[9px] font-black uppercase text-slate-500 text-center leading-tight px-1">Guest Foul</span>
                                <div className="text-xs font-mono font-black text-slate-300">{game.guestFouls}</div>
                            </button>
                        </div>

                        {/* Sub & Timeout */}
                        <div className="grid grid-cols-2 gap-2 flex-1">
                            <button
                                onClick={handleSub}
                                className="bg-input border border-border rounded-xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all"
                            >
                                <Users size={14} className="text-slate-500 mb-0.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Subs</span>
                            </button>
                            <button
                                onClick={() => handleTimeout()}
                                className="bg-input border border-border rounded-xl flex flex-col items-center justify-center hover:bg-card active:scale-95 transition-all"
                            >
                                <div className="flex gap-0.5 mb-1">
                                    {Array.from({ length: game.totalTimeouts }).map((_, i) => (
                                        <div key={i} className={cn("w-2 h-0.5 rounded-full", i < game.homeTimeouts ? "bg-orange-500" : "bg-muted")} />
                                    ))}
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">TO</span>
                            </button>
                        </div>

                        {/* Timer Control - LARGE */}
                        <button
                            onClick={toggleTimer}
                            className={cn(
                                "flex-1 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl",
                                isTimerRunning ? "bg-red-600 shadow-red-900/20" : "bg-emerald-600 shadow-emerald-900/20"
                            )}
                        >
                            <Clock size={24} className={cn("text-white mb-1", isTimerRunning && "animate-pulse")} fill="currentColor" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-white">{isTimerRunning ? 'PAUSE' : 'RESUME'}</span>
                        </button>

                        {/* Box Score Button */}
                        <button
                            onClick={() => router.push(`/game/${id}/box-score`)}
                            className="flex-1 rounded-xl flex flex-col items-center justify-center bg-input border border-border hover:bg-card transition-all active:scale-95"
                        >
                            <Table size={16} className="text-slate-400 mb-0.5" />
                            <span className="text-[8px] font-black tracking-widest uppercase text-slate-500">Box Score</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Subs Overlay */}
            <AnimatePresence>
                {isSubsOpen && game && (
                    <SubsModal
                        game={game}
                        onClose={() => setIsSubsOpen(false)}
                        onSub={(playerId) => {
                            const player = game.rosters.find(r => r.id === playerId);
                            if (player) {
                                const updatedRosters = game.rosters.map(r =>
                                    r.id === player.id ? { ...r, isActive: !r.isActive } : r
                                );
                                updateGame({ rosters: updatedRosters });
                                addEvent({
                                    type: 'sub',
                                    team: player.team,
                                    player: player.name,
                                    description: `${player.name} ${player.isActive ? 'Benched' : 'In'}`
                                });
                            }
                        }}
                        onAmendRoster={() => {
                            setIsSubsOpen(false);
                            setIsAmendRosterOpen(true);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Amend Roster Modal */}
            <AnimatePresence>
                {isAmendRosterOpen && game && (
                    <AmendRosterModal
                        game={game}
                        onClose={() => setIsAmendRosterOpen(false)}
                        onAddPlayer={handleAddRosterPlayer}
                        onUpdatePlayer={handleUpdateRosterPlayer}
                        onRemovePlayer={handleRemoveRosterPlayer}
                    />
                )}
            </AnimatePresence>

            {/* Roster Selection Overlay (for Simple Mode Home Team or Advanced Mode Both) */}
            <AnimatePresence>
                {scoringFor && (
                    <ScoringModal
                        game={game}
                        scoringFor={scoringFor}
                        onClose={() => setScoringFor(null)}
                        onScore={(playerId, team) => {
                            if (playerId) {
                                handlePlayerScore(playerId);
                            } else {
                                // Fallback for team score if we ever add it back
                                const shotType = scoringFor.points === 1 ? 'ft' : scoringFor.points === 3 ? '3pt' : '2pt';
                                if (scoringFor.isMiss) {
                                    addEvent({
                                        type: 'miss',
                                        team,
                                        description: `${team === 'home' ? game.homeTeamName : game.guestTeamName} Miss (Team)`,
                                        value: scoringFor.points,
                                        metadata: { shotType }
                                    });
                                } else {
                                    const update = team === 'home' 
                                        ? { homeScore: game.homeScore + scoringFor.points } 
                                        : { guestScore: game.guestScore + scoringFor.points };
                                    updateGame(update);
                                    addEvent({
                                        type: 'score',
                                        team,
                                        value: scoringFor.points,
                                        metadata: { shotType, points: scoringFor.points },
                                        player: team === 'home' ? game.homeTeamName : game.guestTeamName,
                                        description: `${team === 'home' ? game.homeTeamName : game.guestTeamName} (Team)`
                                    });
                                }
                                setScoringFor(null);
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Event Edit Modal */}
            <AnimatePresence>
                {editingEvent && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl p-6 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Edit Event</h3>
                            <button onClick={() => setEditingEvent(null)} className="p-2 text-slate-400 hover:text-white bg-card rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-8 pb-20">
                            {/* Player Reassignment */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Assigned Player</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {game.rosters
                                        .filter(r => r.team === editingEvent.team)
                                        .map((player, idx) => (
                                            <button
                                                key={player.id || `player-${idx}`}
                                                onClick={() => setEditingEvent({ ...editingEvent, player: player.name })}
                                                className={cn(
                                                    "p-3 rounded-2xl border transition-all flex flex-col items-center gap-1",
                                                    editingEvent.player === player.name
                                                        ? "bg-orange-500/20 border-orange-500 text-orange-100"
                                                        : "bg-input border-border text-slate-500"
                                                )}
                                            >
                                                <div className="text-xl font-black leading-none">{player.number}</div>
                                                <div className="text-[10px] font-bold truncate w-full text-center">{player.name}</div>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* Point Value (if score) */}
                            {editingEvent.type === 'score' && (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Points</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => setEditingEvent({ ...editingEvent, value: val })}
                                                className={cn(
                                                    "flex-1 py-4 rounded-2xl border-2 font-black transition-all",
                                                    editingEvent.value === val
                                                        ? "border-orange-500 bg-orange-500 text-white"
                                                        : "border-border bg-input text-slate-500"
                                                )}
                                            >
                                                +{val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Description/Notes */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Notes</label>
                                <input
                                    type="text"
                                    value={editingEvent.description || ''}
                                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                    placeholder="Add a note (e.g. 'Fast break', 'Three pointer')"
                                    className="w-full bg-input border border-border rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setEditingEvent(null)}
                                className="bg-card text-slate-400 font-bold py-4 rounded-2xl"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={() => handleSaveEdit(editingEvent)}
                                className="bg-orange-600 font-black py-4 rounded-2xl shadow-xl shadow-orange-600/20"
                            >
                                SAVE CHANGES
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Foul Selection Overlay */}
            <AnimatePresence>
                {foulingFor && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl p-8 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-black flex items-center gap-3">
                                <ShieldAlert size={32} className="text-red-500" />
                                <span className="uppercase tracking-tight">WHO FOULED?</span>
                            </h3>
                            <button onClick={() => setFoulingFor(null)} className="p-4 text-slate-400 hover:text-white bg-card rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pb-12">
                            <div className="space-y-4">
                                <h4 className={cn(
                                    "text-sm font-black uppercase tracking-widest px-2",
                                    foulingFor === 'home' ? "text-orange-500" : "text-slate-400"
                                )}>
                                    {foulingFor === 'home' ? (game?.homeTeamName || 'HOME') : (game?.guestTeamName || 'GUEST')}
                                </h4>
                                
                                {/* Show message if no players on team */}
                                {(!game?.rosters || game.rosters.filter(r => r.team === foulingFor && r.isActive).length === 0) ? (
                                    <div className="text-center py-8">
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-4">No players on roster</p>
                                        <button
                                            onClick={() => {
                                                if (!game || !foulingFor) return;
                                                const updates = foulingFor === 'home'
                                                    ? { homeFouls: game.homeFouls + 1 }
                                                    : { guestFouls: game.guestFouls + 1 };
                                                updateGame(updates);
                                                addEvent({
                                                    type: 'foul',
                                                    team: foulingFor,
                                                    player: game[foulingFor === 'home' ? 'homeTeamName' : 'guestTeamName'],
                                                    description: `${game[foulingFor === 'home' ? 'homeTeamName' : 'guestTeamName']} (Team)`
                                                });
                                                setFoulingFor(null);
                                            }}
                                            className="bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 hover:border-red-500 transition-all rounded-2xl p-8 flex flex-col items-center gap-2"
                                        >
                                            <ShieldAlert size={32} className="text-red-500" />
                                            <div className="font-black uppercase tracking-widest text-red-500">Add Team Foul</div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{game?.[foulingFor === 'home' ? 'homeTeamName' : 'guestTeamName']}</div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {game?.rosters
                                            .filter(r => r.team === foulingFor && r.isActive)
                                            .map((entry, idx) => (
                                                <button
                                                    key={entry.id || `foul-entry-${idx}`}
                                                    onClick={() => handlePlayerFoul(entry.id)}
                                                    className="bg-input border border-border p-6 rounded-2xl flex flex-col items-center hover:border-red-500 transition-all active:scale-95 group shadow-xl"
                                                >
                                                    <div className="text-4xl font-black text-slate-500 group-hover:text-white mb-1 transition-colors">{entry.number}</div>
                                                    <div className="text-sm font-bold truncate w-full text-center group-hover:text-white transition-colors">{entry.name}</div>
                                                    <div className="mt-2 text-[10px] font-black text-slate-700 bg-background px-2 py-0.5 rounded uppercase group-hover:bg-red-500/10 group-hover:text-red-400 transition-all">
                                                        {entry.fouls} Fouls
                                                    </div>
                                                </button>
                                            ))}

                                        <button
                                            onClick={() => {
                                                if (!game || !foulingFor) return;
                                                const updates = foulingFor === 'home'
                                                    ? { homeFouls: game.homeFouls + 1 }
                                                    : { guestFouls: game.guestFouls + 1 };
                                                updateGame(updates);
                                                addEvent({
                                                    type: 'foul',
                                                    team: foulingFor,
                                                    player: game[foulingFor === 'home' ? 'homeTeamName' : 'guestTeamName'],
                                                    description: `${game[foulingFor === 'home' ? 'homeTeamName' : 'guestTeamName']} (Team)`
                                                });
                                                setFoulingFor(null);
                                            }}
                                            className="bg-card border-dashed border-2 border-border p-6 rounded-2xl flex flex-col items-center justify-center italic text-slate-400 text-xs gap-1 hover:border-slate-500 hover:text-white transition-all active:scale-95 shadow-xl"
                                        >
                                            <ShieldAlert size={20} />
                                            <div className="font-black uppercase">Technical</div>
                                            <div className="opacity-50 text-[10px]">Team Foul</div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setFoulingFor(null)}
                            className="bg-card text-white font-black py-5 rounded-3xl shadow-lg active:scale-95 transition-all text-sm tracking-widest uppercase mb-4"
                        >
                            CANCEL
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeout Selection Overlay */}
            <AnimatePresence>
                {isTimeoutOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-xl p-8 flex flex-col items-center justify-center"
                    >
                        <div className="max-w-md w-full space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-4xl font-black uppercase tracking-tighter">CALL TIMEOUT</h3>
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Select the calling team</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => handleTimeout('home')}
                                    disabled={game.homeTimeouts <= 0}
                                    className={cn(
                                        "p-8 rounded-[32px] border-2 flex flex-col items-center gap-2 transition-all active:scale-95",
                                        game.homeTimeouts > 0
                                            ? "bg-orange-600/10 border-orange-500/50 hover:bg-orange-600/20"
                                            : "bg-input/50 border-border opacity-50 grayscale cursor-not-allowed"
                                    )}
                                >
                                    <div className="text-sm font-black text-orange-500 uppercase tracking-widest">{game.homeTeamName}</div>
                                    <div className="text-5xl font-black text-white">{game.homeTimeouts}</div>
                                    <div className="text-[10px] font-bold text-orange-500/50 uppercase tracking-[0.2em]">Available</div>
                                </button>

                                <button
                                    onClick={() => handleTimeout('guest')}
                                    disabled={game.guestTimeouts <= 0}
                                    className={cn(
                                        "p-8 rounded-[32px] border-2 flex flex-col items-center gap-2 transition-all active:scale-95",
                                        game.guestTimeouts > 0
                                            ? "bg-input border-white/10 hover:bg-card"
                                            : "bg-input/50 border-border opacity-50 grayscale cursor-not-allowed"
                                    )}
                                >
                                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{game.guestTeamName}</div>
                                    <div className="text-5xl font-black text-white">{game.guestTimeouts}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Available</div>
                                </button>
                            </div>

                            <button
                                onClick={() => setIsTimeoutOpen(false)}
                                className="w-full py-5 text-slate-500 font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
                            >
                                Nevermind, Continue Play
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Share Modal */}
            <AnimatePresence>
                {isShareOpen && (
                    <motion.div
                        key="share-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-input border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
                        >
                            <button
                                onClick={() => setIsShareOpen(false)}
                                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-white rounded-2xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                    <QRCode
                                        value={`${window.location.origin}/game/${id}`}
                                        size={200}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>

                                <h3 className="text-xl font-black mb-2 tracking-tight">Public Scoreboard</h3>
                                <p className="text-sm text-slate-500 text-center mb-8">
                                    Share this with fans to follow the live broadcast from the arena.
                                </p>

                                <div className="w-full space-y-3">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/game/${id}`);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="w-full bg-card hover:bg-muted p-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
                                    >
                                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        {copied ? 'COPIED!' : 'COPY URL'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: 'Live Scoreboard',
                                                    text: 'Follow the live action here!',
                                                    url: `${window.location.origin}/game/${id}`,
                                                });
                                            }
                                        }}
                                        className="w-full bg-orange-600 hover:bg-orange-500 p-4 rounded-2xl flex items-center justify-center gap-2 font-black transition-all active:scale-95"
                                    >
                                        <Share2 size={18} />
                                        SHARE LINK
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {isTimeEditing && (
                    <motion.div
                        key="time-edit-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-input border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
                        >
                            <button
                                onClick={() => setIsTimeEditing(false)}
                                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
                            >
                                <X size={24} />
                            </button>

                            <h3 className="text-xl font-black mb-6 tracking-tight flex items-center gap-2">
                                <Clock size={24} className="text-orange-500" />
                                Edit Game Clock
                            </h3>

                            <div className="flex items-center justify-center gap-4 mb-8">
                                <div className="flex flex-col items-center gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Minutes</label>
                                    <input
                                        type="number"
                                        value={tempTime.min}
                                        onChange={(e) => setTempTime({ ...tempTime, min: e.target.value })}
                                        className="w-24 h-24 bg-black/40 border border-border rounded-2xl text-5xl font-mono font-black text-center focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div className="text-4xl font-black text-slate-600 mb-6">:</div>
                                <div className="flex flex-col items-center gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Seconds</label>
                                    <input
                                        type="number"
                                        value={tempTime.sec}
                                        onChange={(e) => setTempTime({ ...tempTime, sec: e.target.value })}
                                        className="w-24 h-24 bg-black/40 border border-border rounded-2xl text-5xl font-mono font-black text-center focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const mins = parseInt(tempTime.min) || 0;
                                    const secs = parseInt(tempTime.sec) || 0;
                                    updateGame({ clockSeconds: (mins * 60) + secs });
                                    setIsTimeEditing(false);
                                }}
                                className="w-full bg-card hover:bg-muted p-4 rounded-2xl font-bold mb-4 transition-all active:scale-95 text-white"
                            >
                                Update Time
                            </button>

                            <div className="h-px bg-white/5 my-6" />

                            <button
                                onClick={() => {
                                    nextPeriod();
                                    setIsTimeEditing(false);
                                }}
                                className="w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-500 border border-orange-500/20 p-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mb-4"
                            >
                                Start Next Period
                                <ArrowLeft className="rotate-180" size={16} />
                            </button>

                            {/* End Game Button */}
                            <button
                                onClick={() => {
                                    setIsTimeEditing(false);
                                    setIsEndGameOpen(true);
                                }}
                                disabled={game?.status === 'final'}
                                className={cn(
                                    "w-full p-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                                    game?.status === 'final'
                                        ? "bg-card text-slate-600 cursor-not-allowed"
                                        : "bg-red-950/30 border border-red-500/30 text-red-400 hover:bg-red-900/40"
                                )}
                            >
                                <Flag size={18} />
                                {game?.status === 'final' ? 'Game Finalized' : 'End Game'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}

                {/* End Game Confirmation Modal */}
                {isEndGameOpen && (
                    <motion.div
                        key="end-game-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[130] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-input border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                    <Flag size={32} className="text-red-500" />
                                </div>

                                <h3 className="text-2xl font-black mb-2 tracking-tight">End Game?</h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    This will finalize the game with the current score and prevent further scoring.
                                </p>

                                <div className="w-full space-y-3">
                                    <div className="bg-card/50 rounded-2xl p-4 mb-6">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Final Score</div>
                                        <div className="flex items-center justify-center gap-4">
                                            <div className="text-center">
                                                <div className="text-xs font-bold text-orange-500 uppercase">{game?.homeTeamName}</div>
                                                <div className="text-3xl font-black">{game?.homeScore}</div>
                                            </div>
                                            <div className="text-slate-600 font-black">-</div>
                                            <div className="text-center">
                                                <div className="text-xs font-bold text-slate-400 uppercase">{game?.guestTeamName}</div>
                                                <div className="text-3xl font-black">{game?.guestScore}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsEndGameOpen(false)}
                                        className="w-full bg-card hover:bg-muted p-4 rounded-2xl font-bold transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={handleEndGame}
                                        className="w-full bg-red-600 hover:bg-red-500 p-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Flag size={18} />
                                        End Game
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Scorer Manager Modal */}
                <ScorerManager
                    key="scorer-manager"
                    gameId={id as string}
                    ownerId={game.ownerId}
                    currentUserId={userId}
                    scorers={scorers}
                    isOpen={isScorersOpen}
                    onClose={() => setIsScorersOpen(false)}
                    onAddScorer={handleAddScorer}
                    onRemoveScorer={handleRemoveScorer}
                />

                {/* Game Settings Modal */}
                {isSettingsOpen && game && (
                    <div key="settings-modal">
                        <GameSettingsModal
                            game={game}
                            onClose={() => setIsSettingsOpen(false)}
                            onSave={handleSaveSettings}
                            isSaving={isSavingSettings}
                            canDelete={canDeleteGame()}
                            onDelete={handleDeleteGame}
                        />
                    </div>
                )}
                {/* Delete Confirmation Modal */}
                {isDeleteConfirmOpen && (
                    <div key="delete-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-input border border-border rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Delete Game?</h3>
                            <p className="text-slate-400 mb-6">
                                Are you sure you want to delete this game? This will soft-delete the game and it can be restored by a community admin or world admin.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="flex-1 bg-muted hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteGame}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
