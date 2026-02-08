import { Server, Socket } from "socket.io";
import { db } from "@/db";
import { games, gameEvents, gameScorers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Server-side timer management for centralized clock
interface ActiveTimer {
    gameId: string;
    intervalId: NodeJS.Timeout;
    lastTickAt: number;
    startedAt: Date;
    initialClockSeconds: number;
}

const activeTimers = new Map<string, ActiveTimer>();

// Calculate current clock seconds based on when timer started
function calculateCurrentClock(timer: ActiveTimer, periodSeconds: number): number {
    const elapsedMs = Date.now() - timer.startedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const currentClock = timer.initialClockSeconds - elapsedSeconds;
    return Math.max(0, Math.min(currentClock, periodSeconds));
}

// Start a centralized timer for a game
async function startTimer(gameId: string, socket: Socket, io: Server) {
    console.log(`[Timer] Starting timer for game ${gameId}`);
    
    // Stop existing timer if any
    stopTimer(gameId);
    
    try {
        // Fetch current game state
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (!game || game.clockSeconds <= 0) {
            console.log(`[Timer] Cannot start timer for ${gameId}: clock at ${game?.clockSeconds}`);
            return;
        }
        
        const now = new Date();
        
        // Update database with timer start and game status
        await db.update(games)
            .set({ 
                isTimerRunning: true, 
                status: 'live', // Mark game as live when timer starts
                timerStartedAt: now,
                updatedAt: now
            })
            .where(eq(games.id, gameId));
        
        // Create active timer entry
        const timer: ActiveTimer = {
            gameId,
            intervalId: setInterval(() => {
                tickTimer(gameId, io);
            }, 1000), // Tick every second
            lastTickAt: Date.now(),
            startedAt: now,
            initialClockSeconds: game.clockSeconds
        };
        
        activeTimers.set(gameId, timer);
        
        // Broadcast timer started to all room members
        io.to(`game-${gameId}`).emit('timer-started', {
            gameId,
            clockSeconds: game.clockSeconds,
            startedAt: now.toISOString()
        });

        // Broadcast game status update to all room members
        io.to(`game-${gameId}`).emit('game-updated', {
            status: 'live',
            isTimerRunning: true
        });
        
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
        // Fetch current game to calculate final clock
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (game && game.isTimerRunning) {
            // Calculate final clock time
            let finalClockSeconds = game.clockSeconds;
            
            if (timer && game.timerStartedAt) {
                finalClockSeconds = calculateCurrentClock(timer, game.periodSeconds);
            }
            
            // Update database
            await db.update(games)
                .set({ 
                    isTimerRunning: false, 
                    clockSeconds: finalClockSeconds,
                    timerStartedAt: null,
                    updatedAt: new Date()
                })
                .where(eq(games.id, gameId));
            
            // Broadcast to all room members
            if (io) {
                io.to(`game-${gameId}`).emit('timer-stopped', {
                    gameId,
                    clockSeconds: finalClockSeconds
                });
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
        // Fetch game to get period length
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (!game) return;
        
        // Calculate current clock
        const currentClock = calculateCurrentClock(timer, game.periodSeconds);
        timer.lastTickAt = Date.now();
        
        // Broadcast to all room members
        io.to(`game-${gameId}`).emit('clock-update', {
            gameId,
            clockSeconds: currentClock,
            isTimerRunning: true
        });
        
        // If clock reaches 0, stop automatically
        if (currentClock <= 0) {
            console.log(`[Timer] Clock reached 0 for game ${gameId}, auto-stopping`);
            await stopTimer(gameId, undefined, io);
        }
        
    } catch (error) {
        console.error(`[Timer] Error ticking timer for ${gameId}:`, error);
    }
}

// Check if user is authorized to control timer
async function isAuthorizedScorer(gameId: string, userId: string): Promise<boolean> {
    try {
        // Check if user is owner
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });
        
        if (game?.ownerId === userId) return true;
        
        // Check if user is in game_scorers with co_scorer or owner role
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

export function setupSocket(io: Server) {
    io.on("connection", (socket: Socket) => {
        console.log("[Socket] Client connected", socket.id);
        
        // Store user info from auth (you'll need to pass this from client)
        let userId: string | null = null;

        socket.on("authenticate", (data: { userId: string }) => {
            userId = data.userId;
            console.log(`[Socket] Client ${socket.id} authenticated as ${userId}`);
        });

        socket.on("join-game", async (gameId) => {
            socket.join(`game-${gameId}`);
            console.log(`[Socket] ${socket.id} joined game-${gameId}`);

            // Fetch and send current game state to the connecting client
            try {
                const game = await db.query.games.findFirst({
                    where: eq(games.id, gameId),
                    with: {
                        rosters: true,
                        scorers: true,
                        events: {
                            orderBy: (events, { desc }) => [desc(events.createdAt)]
                        }
                    }
                });

                if (game) {
                    // Calculate current clock if timer is running
                    let currentClockSeconds = game.clockSeconds;
                    if (game.isTimerRunning && game.timerStartedAt) {
                        const timer = activeTimers.get(gameId);
                        if (timer) {
                            currentClockSeconds = calculateCurrentClock(timer, game.periodSeconds);
                        } else {
                            // Timer should be running but isn't in memory - restart it
                            const now = new Date();
                            const elapsedMs = now.getTime() - game.timerStartedAt.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000);
                            currentClockSeconds = Math.max(0, game.clockSeconds - elapsedSeconds);
                            
                            // Restart the timer in memory
                            if (currentClockSeconds > 0) {
                                const newTimer: ActiveTimer = {
                                    gameId,
                                    intervalId: setInterval(() => {
                                        tickTimer(gameId, io);
                                    }, 1000),
                                    lastTickAt: Date.now(),
                                    startedAt: game.timerStartedAt,
                                    initialClockSeconds: game.clockSeconds + elapsedSeconds // Original clock before subtraction
                                };
                                activeTimers.set(gameId, newTimer);
                            }
                        }
                    }
                    
                    // Send full game state to the connecting client
                    socket.emit("game-state", {
                        game: {
                            id: game.id,
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
                    console.log(`[Socket] Game state sent to ${socket.id} for game ${gameId} with clock=${currentClockSeconds}`);
                }
            } catch (error) {
                console.error(`[Socket] Error fetching game state for ${gameId}:`, error);
            }
        });
        
        // Handle timer control commands
        socket.on("timer-control", async (data: { 
            gameId: string; 
            action: 'start' | 'stop';
            userId: string;
        }) => {
            console.log(`[Socket] Timer control received:`, data);
            
            // Verify authorization
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

        socket.on("update-game", ({ gameId, updates }) => {
            // Broadcast to everyone in the room except sender
            socket.to(`game-${gameId}`).emit("game-updated", updates);
            console.log(`[Socket] Game ${gameId} updated`, updates);
        });

        socket.on("add-event", ({ gameId, event }) => {
            // Broadcast to everyone in the room except sender
            socket.to(`game-${gameId}`).emit("event-added", event);
            console.log(`[Socket] Event added to game ${gameId}`, event);
        });

        socket.on("disconnect", () => {
            console.log("[Socket] Client disconnected", socket.id);
        });
    });
}

// Cleanup function for server shutdown
export function cleanupTimers() {
    console.log('[Timer] Cleaning up all active timers...');
    for (const [gameId, timer] of activeTimers) {
        clearInterval(timer.intervalId);
        console.log(`[Timer] Stopped timer for game ${gameId}`);
    }
    activeTimers.clear();
}
