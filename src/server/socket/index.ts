/**
 * Optimized Socket.io Server Configuration
 * 
 * High-performance WebSocket server designed to handle 10K+ concurrent connections.
 * Implements connection pooling, rate limiting, message batching, and multi-server
 * scaling via Redis adapter.
 * 
 * Key Features:
 * - 10,000 concurrent spectator support
 * - Rate limiting (60 events/min per socket, 120 events/min per game)
 * - Message batching for efficient broadcasting
 * - Connection load shedding under extreme load
 * - Real-time metrics and health monitoring
 * - Redis adapter for horizontal scaling
 */

import { Server, Socket } from "socket.io";
import { db } from "@/db";
import { games, gameScorers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { metricsCollector } from "./metrics";
import { socketRateLimiter } from "./rate-limiter";
import { optimizedBroadcaster } from "./broadcast";
import { initializeRedisAdapter, closeRedisAdapter } from "./redis-adapter";

// Server-side timer management for centralized clock
interface ActiveTimer {
    gameId: string;
    intervalId: ReturnType<typeof setInterval>;
    lastTickAt: number;
    startedAt: Date;
    initialClockSeconds: number;
}

const activeTimers = new Map<string, ActiveTimer>();

// Load shedding threshold
const MAX_CONNECTIONS = 15000;
const SOFT_LIMIT = 12000;

// Calculate current clock seconds based on when timer started
function calculateCurrentClock(timer: ActiveTimer, periodSeconds: number): number {
    const elapsedMs = Date.now() - timer.startedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const currentClock = timer.initialClockSeconds - elapsedSeconds;
    return Math.max(0, Math.min(currentClock, periodSeconds));
}

// Check if user is authorized to control timer
async function isAuthorizedScorer(gameId: string, userId: string): Promise<boolean> {
    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (game?.ownerId === userId) return true;
        
        const scorer = await db.query.gameScorers.findFirst({
            where: and(
                eq(gameScorers.gameId, gameId),
                eq(gameScorers.userId, userId)
            ),
        });
        
        return scorer !== undefined;
    } catch (error) {
        console.error(`[Timer] Error checking authorization for ${userId}:`, error);
        return false;
    }
}

// Start a centralized timer for a game
async function startTimer(gameId: string, socket: Socket, io: Server) {
    console.log(`[Timer] Starting timer for game ${gameId}`);
    
    stopTimer(gameId);
    
    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (!game || game.clockSeconds <= 0) {
            console.log(`[Timer] Cannot start timer for ${gameId}: clock at ${game?.clockSeconds}`);
            return;
        }
        
        const now = new Date();
        
        await db.update(games)
            .set({ 
                isTimerRunning: true, 
                status: 'live',
                timerStartedAt: now,
                updatedAt: now
            })
            .where(eq(games.id, gameId));
        
        const timer: ActiveTimer = {
            gameId,
            intervalId: setInterval(() => {
                tickTimer(gameId, io);
            }, 1000),
            lastTickAt: Date.now(),
            startedAt: now,
            initialClockSeconds: game.clockSeconds
        };
        
        activeTimers.set(gameId, timer);
        
        // Use optimized broadcaster for timer events (high priority)
        optimizedBroadcaster.queueBroadcast(
            `game-${gameId}`,
            'timer-started',
            {
                gameId,
                clockSeconds: game.clockSeconds,
                startedAt: now.toISOString()
            },
            'high'
        );

        optimizedBroadcaster.queueBroadcast(
            `game-${gameId}`,
            'game-updated',
            {
                status: 'live',
                isTimerRunning: true
            },
            'high'
        );
        
        console.log(`[Timer] Timer started for game ${gameId} at ${game.clockSeconds}s`);
        
    } catch (error) {
        console.error(`[Timer] Error starting timer for ${gameId}:`, error);
    }
}

// Stop a centralized timer
async function stopTimer(gameId: string, socket?: Socket, io?: Server) {
    console.log(`[Timer] Stopping timer for game ${gameId}`);
    
    const timer = activeTimers.get(gameId);
    if (timer) {
        clearInterval(timer.intervalId);
        activeTimers.delete(gameId);
    }
    
    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (game && game.isTimerRunning) {
            let finalClockSeconds = game.clockSeconds;
            
            if (timer && game.timerStartedAt) {
                finalClockSeconds = calculateCurrentClock(timer, game.periodSeconds);
            }
            
            await db.update(games)
                .set({ 
                    isTimerRunning: false, 
                    clockSeconds: finalClockSeconds,
                    timerStartedAt: null,
                    updatedAt: new Date()
                })
                .where(eq(games.id, gameId));
            
            if (io) {
                optimizedBroadcaster.queueBroadcast(
                    `game-${gameId}`,
                    'timer-stopped',
                    {
                        gameId,
                        clockSeconds: finalClockSeconds
                    },
                    'high'
                );
            }
            
            console.log(`[Timer] Timer stopped for game ${gameId} at ${finalClockSeconds}s`);
        }
    } catch (error) {
        console.error(`[Timer] Error stopping timer for ${gameId}:`, error);
    }
}

// Tick the timer (called every second)
async function tickTimer(gameId: string, io: Server) {
    const timer = activeTimers.get(gameId);
    if (!timer) return;
    
    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (!game) return;
        
        const currentClock = calculateCurrentClock(timer, game.periodSeconds);
        timer.lastTickAt = Date.now();
        
        // Use optimized broadcaster for clock updates (high priority)
        optimizedBroadcaster.queueBroadcast(
            `game-${gameId}`,
            'clock-update',
            {
                gameId,
                clockSeconds: currentClock,
                isTimerRunning: true
            },
            'high'
        );
        
        if (currentClock <= 0) {
            console.log(`[Timer] Clock reached 0 for game ${gameId}, auto-stopping`);
            await stopTimer(gameId, undefined, io);
        }
        
    } catch (error) {
        console.error(`[Timer] Error ticking timer for ${gameId}:`, error);
    }
}

// Load shedding check
function shouldAcceptConnection(): boolean {
    const metrics = metricsCollector.getMetrics();
    
    // Hard limit - reject connections
    if (metrics.activeConnections >= MAX_CONNECTIONS) {
        console.warn(`[LoadShedding] Connection rejected: max capacity reached (${metrics.activeConnections})`);
        return false;
    }
    
    // Soft limit - log warning but still accept
    if (metrics.activeConnections >= SOFT_LIMIT) {
        console.warn(`[LoadShedding] Approaching capacity: ${metrics.activeConnections}/${MAX_CONNECTIONS}`);
    }
    
    return true;
}

// Main socket setup function
export async function setupSocket(io: Server) {
    console.log("[Socket] Setting up optimized Socket.io server...");
    
    // Initialize Redis adapter for multi-server support
    await initializeRedisAdapter(io);
    
    // Initialize optimized broadcaster
    optimizedBroadcaster.initialize(io);
    
    // Start metrics logging (every 30 seconds)
    setInterval(() => {
        metricsCollector.logMetrics();
        
        // Adapt batching strategy based on load
        const metrics = metricsCollector.getMetrics();
        optimizedBroadcaster.adaptToLoad(metrics.activeConnections);
    }, 30000);
    
    io.on("connection", async (socket: Socket) => {
        const clientIp = socket.handshake.address || 'unknown';
        const socketId = socket.id;
        
        // Load shedding check
        if (!shouldAcceptConnection()) {
            socket.emit('error', { 
                code: 'SERVER_AT_CAPACITY',
                message: 'Server is at maximum capacity. Please try again later.' 
            });
            socket.disconnect(true);
            return;
        }
        
        // Rate limit check for connection
        const rateLimitResult = await socketRateLimiter.checkConnectionAllowed(clientIp);
        if (!rateLimitResult.allowed) {
            console.log(`[RateLimit] Connection rejected from ${clientIp}: rate limit exceeded`);
            socket.emit('error', { 
                code: 'RATE_LIMITED',
                message: `Too many connections. Retry after ${Math.ceil(rateLimitResult.msBeforeNext / 1000)}s` 
            });
            socket.disconnect(true);
            metricsCollector.recordRateLimitHit();
            return;
        }
        
        // Record successful connection
        metricsCollector.recordConnection();
        console.log(`[Socket] Client connected: ${socketId} from ${clientIp} (${metricsCollector.getMetrics().activeConnections} total)`);
        
        let userId: string | null = null;

        socket.on("authenticate", async (data: { userId: string }) => {
            userId = data.userId;
            console.log(`[Socket] Client ${socketId} authenticated as ${userId}`);
            
            // Reset connection rate limit for authenticated user
            await socketRateLimiter.resetConnectionLimit(clientIp);
        });

        socket.on("join-game", async (gameId) => {
            // Rate limit join attempts
            const rateLimit = await socketRateLimiter.checkEventAllowed(socketId);
            if (!rateLimit.allowed) {
                socket.emit('error', { 
                    code: 'RATE_LIMITED',
                    message: 'Too many join attempts. Please slow down.' 
                });
                metricsCollector.recordRateLimitHit();
                return;
            }
            
            socket.join(`game-${gameId}`);
            metricsCollector.updateRoomCount(gameId, io.sockets.adapter.rooms.get(`game-${gameId}`)?.size || 0);
            console.log(`[Socket] ${socketId} joined game-${gameId}`);

            try {
                const game = await db.query.games.findFirst({
                    where: eq(games.id, gameId),
                    with: {
                        rosters: true,
                        scorers: true,
                        events: {
                            orderBy: (events, { desc }) => [desc(events.createdAt)]
                        },
                        community: {
                            with: {
                                members: true
                            }
                        }
                    }
                });

                if (game) {
                    let currentClockSeconds = game.clockSeconds;
                    if (game.isTimerRunning && game.timerStartedAt) {
                        const timer = activeTimers.get(gameId);
                        if (timer) {
                            currentClockSeconds = calculateCurrentClock(timer, game.periodSeconds);
                        } else {
                            const now = new Date();
                            const elapsedMs = now.getTime() - game.timerStartedAt.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000);
                            currentClockSeconds = Math.max(0, game.clockSeconds - elapsedSeconds);
                            
                            if (currentClockSeconds > 0) {
                                const newTimer: ActiveTimer = {
                                    gameId,
                                    intervalId: setInterval(() => {
                                        tickTimer(gameId, io);
                                    }, 1000),
                                    lastTickAt: Date.now(),
                                    startedAt: game.timerStartedAt,
                                    initialClockSeconds: game.clockSeconds + elapsedSeconds
                                };
                                activeTimers.set(gameId, newTimer);
                            }
                        }
                    }
                    
                    socket.emit("game-state", {
                        game: {
                            id: game.id,
                            ownerId: game.ownerId,
                            communityId: game.communityId,
                            community: game.community,
                            homeTeamName: game.homeTeamName,
                            guestTeamName: game.guestTeamName,
                            homeScore: game.homeScore,
                            guestScore: game.guestScore,
                            homeFouls: game.homeFouls,
                            guestFouls: game.guestFouls,
                            homeTimeouts: game.homeTimeouts,
                            guestTimeouts: game.guestTimeouts,
                            totalTimeouts: game.totalTimeouts,
                            currentPeriod: game.currentPeriod,
                            totalPeriods: game.totalPeriods,
                            periodSeconds: game.periodSeconds,
                            clockSeconds: currentClockSeconds,
                            possession: game.possession,
                            mode: game.mode,
                            status: game.status,
                            isTimerRunning: game.isTimerRunning,
                            rosters: game.rosters,
                            scorers: game.scorers
                        },
                        events: game.events.map(e => ({
                            ...e,
                            timestamp: e.createdAt
                        }))
                    });
                    console.log(`[Socket] Game state sent to ${socketId} for game ${gameId}`);
                }
            } catch (error) {
                console.error(`[Socket] Error fetching game state for ${gameId}:`, error);
                metricsCollector.recordEventError();
            }
        });
        
        socket.on("timer-control", async (data: { 
            gameId: string; 
            action: 'start' | 'stop';
            userId: string;
        }) => {
            console.log(`[Socket] Timer control received:`, data);
            
            // Rate limit timer controls
            const rateLimit = await socketRateLimiter.checkEventAllowed(socketId);
            if (!rateLimit.allowed) {
                socket.emit('error', { 
                    code: 'RATE_LIMITED',
                    message: 'Too many timer control attempts. Please slow down.' 
                });
                metricsCollector.recordRateLimitHit();
                return;
            }
            
            const isAuthorized = await isAuthorizedScorer(data.gameId, data.userId);
            if (!isAuthorized) {
                console.log(`[Socket] Unauthorized timer control attempt by ${data.userId}`);
                socket.emit('error', { message: 'Not authorized to control timer' });
                return;
            }
            
            if (data.action === 'start') {
                await startTimer(data.gameId, socket, io);
            } else if (data.action === 'stop') {
                await stopTimer(data.gameId, socket, io);
            }
        });

        socket.on("update-game", async ({ gameId, updates }) => {
            // Rate limit game updates
            const rateLimit = await socketRateLimiter.checkEventAllowed(socketId);
            if (!rateLimit.allowed) {
                socket.emit('error', { 
                    code: 'RATE_LIMITED',
                    message: 'Too many updates. Please slow down.' 
                });
                metricsCollector.recordRateLimitHit();
                return;
            }
            
            // Use optimized broadcaster
            optimizedBroadcaster.queueBroadcast(
                `game-${gameId}`,
                'game-updated',
                updates,
                'normal'
            );
            console.log(`[Socket] Game ${gameId} updated`, updates);

            // Handle public broadcasts
            try {
                const game = await db.query.games.findFirst({
                    where: eq(games.id, gameId),
                    columns: { visibility: true, communityId: true }
                });

                if (game && (game.visibility === 'public_general' || game.visibility === 'public_community')) {
                    optimizedBroadcaster.queueBroadcast(
                        'public-games',
                        'public-game-update',
                        { gameId, ...updates },
                        'low'
                    );

                    if (game.communityId) {
                        optimizedBroadcaster.queueBroadcast(
                            `community-${game.communityId}`,
                            'community-game-update',
                            { gameId, ...updates },
                            'low'
                        );
                    }
                }
            } catch (error) {
                console.error(`[Socket] Error broadcasting public update for ${gameId}:`, error);
            }
        });

        socket.on("add-event", async ({ gameId, event }) => {
            // Rate limit event additions (both per socket and per game)
            const socketRate = await socketRateLimiter.checkEventAllowed(socketId);
            const gameRate = await socketRateLimiter.checkGameEventAllowed(gameId);
            
            if (!socketRate.allowed || !gameRate.allowed) {
                socket.emit('error', { 
                    code: 'RATE_LIMITED',
                    message: 'Too many events. Please slow down.' 
                });
                metricsCollector.recordRateLimitHit();
                return;
            }
            
            optimizedBroadcaster.queueBroadcast(
                `game-${gameId}`,
                'event-added',
                event,
                'normal'
            );
            console.log(`[Socket] Event added to game ${gameId}`, event);
        });

        socket.on("join-public-games", () => {
            socket.join("public-games");
            console.log(`[Socket] ${socketId} joined public-games room`);
        });

        socket.on("leave-public-games", () => {
            socket.leave("public-games");
            console.log(`[Socket] ${socketId} left public-games room`);
        });

        socket.on("join-community", (communityId: string) => {
            socket.join(`community-${communityId}`);
            console.log(`[Socket] ${socketId} joined community-${communityId}`);
        });

        socket.on("leave-community", (communityId: string) => {
            socket.leave(`community-${communityId}`);
            console.log(`[Socket] ${socketId} left community-${communityId}`);
        });

        socket.on("disconnect", () => {
            metricsCollector.recordDisconnection();
            console.log(`[Socket] Client disconnected: ${socketId} (${metricsCollector.getMetrics().activeConnections} remaining)`);
        });
    });
    
    console.log("[Socket] Optimized Socket.io server setup complete");
    console.log(`[Socket] Configuration: Max ${MAX_CONNECTIONS} connections, batching enabled`);
}

// Broadcast game updates to public rooms
interface GameUpdateData {
    homeScore?: number;
    guestScore?: number;
    homeFouls?: number;
    guestFouls?: number;
    clockSeconds?: number;
    currentPeriod?: number;
    status?: string;
    isTimerRunning?: boolean;
    [key: string]: unknown;
}

export function broadcastToPublicGames(io: Server, gameId: string, data: GameUpdateData) {
    optimizedBroadcaster.queueBroadcast(
        'public-games',
        'public-game-update',
        { gameId, ...data },
        'low'
    );
}

export function broadcastToCommunity(io: Server, communityId: string, gameId: string, data: GameUpdateData) {
    optimizedBroadcaster.queueBroadcast(
        `community-${communityId}`,
        'community-game-update',
        { gameId, ...data },
        'low'
    );
}

// Cleanup function for server shutdown
export async function cleanupSocketServer() {
    console.log('[Socket] Cleaning up socket server...');
    
    // Stop optimized broadcaster
    optimizedBroadcaster.stop();
    
    // Stop all timers
    console.log('[Timer] Cleaning up all active timers...');
    for (const [gameId, timer] of activeTimers) {
        clearInterval(timer.intervalId);
        console.log(`[Timer] Stopped timer for game ${gameId}`);
    }
    activeTimers.clear();
    
    // Close Redis adapter
    await closeRedisAdapter();
    
    console.log('[Socket] Socket server cleanup complete');
}

// Export cleanupTimers for backward compatibility
export function cleanupTimers() {
    console.log('[Timer] Cleaning up all active timers...');
    for (const [gameId, timer] of activeTimers) {
        clearInterval(timer.intervalId);
        console.log(`[Timer] Stopped timer for game ${gameId}`);
    }
    activeTimers.clear();
}

// Export metrics collector for external monitoring
export { metricsCollector };
