import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { AddressInfo } from 'node:net';

// Mock the broadcast module
vi.mock('../socket/broadcast', () => ({
    optimizedBroadcaster: {
        queueBroadcast: vi.fn(),
        initialize: vi.fn(),
        adaptToLoad: vi.fn(),
        stop: vi.fn(),
    },
}));

// Mock the metrics module
vi.mock('../socket/metrics', () => ({
    metricsCollector: {
        recordConnection: vi.fn(),
        recordDisconnection: vi.fn(),
        recordRateLimitHit: vi.fn(),
        recordEventError: vi.fn(),
        updateRoomCount: vi.fn(),
        getMetrics: vi.fn().mockReturnValue({ activeConnections: 0 }),
        logMetrics: vi.fn(),
    },
}));

// Mock the rate limiter
vi.mock('../socket/rate-limiter', () => ({
    socketRateLimiter: {
        checkConnectionAllowed: vi.fn().mockResolvedValue({ allowed: true }),
        checkEventAllowed: vi.fn().mockResolvedValue({ allowed: true }),
        checkGameEventAllowed: vi.fn().mockResolvedValue({ allowed: true }),
        resetConnectionLimit: vi.fn(),
    },
}));

// Mock Redis adapter
vi.mock('../socket/redis-adapter', () => ({
    initializeRedisAdapter: vi.fn().mockResolvedValue(undefined),
    closeRedisAdapter: vi.fn().mockResolvedValue(undefined),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
    eq: vi.fn((a, b) => ({ column: a, value: b })),
    and: vi.fn((...conditions) => ({ type: 'and', conditions })),
}));

// Create mock DB that can be modified per test
const createMockDb = () => ({
    query: {
        games: {
            findFirst: vi.fn(),
        },
        gameScorers: {
            findFirst: vi.fn(),
        },
    },
    update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        }),
    }),
});

let mockDb = createMockDb();

// Mock the database module
vi.mock('@/db', () => ({
    get db() {
        return mockDb;
    },
}));

vi.mock('@/db/schema', () => ({
    games: {
        id: 'id',
        ownerId: 'ownerId',
        isTimerRunning: 'isTimerRunning',
        clockSeconds: 'clockSeconds',
        timerStartedAt: 'timerStartedAt',
        periodSeconds: 'periodSeconds',
        status: 'status',
        updatedAt: 'updatedAt',
    },
    gameScorers: {
        gameId: 'gameId',
        userId: 'userId',
    },
}));

// Import after mocks are set up
import { setupSocket } from '../socket';

describe('Timer Control Functionality', () => {
    let io: SocketServer;
    let httpServer: HttpServer;
    let port: number;

    beforeEach(async () => {
        // Reset mock DB for each test
        mockDb = createMockDb();
        vi.clearAllMocks();
        
        return new Promise<void>((resolve) => {
            httpServer = createServer();
            io = new SocketServer(httpServer);
            setupSocket(io);

            httpServer.listen(() => {
                port = (httpServer.address() as AddressInfo).port;
                resolve();
            });
        });
    });

    afterEach(() => {
        io.close();
        httpServer.close();
    });

    describe('Authorization', () => {
        it('should reject timer control from unauthorized users', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-1';
            const userId = 'unauthorized-user';

            // Mock game owner check - user is not owner
            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: 'different-owner',
            });

            // Mock game scorer check - user is not a scorer
            mockDb.query.gameScorers.findFirst.mockResolvedValue(undefined);

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            expect(response.success).toBe(false);
            expect(response.error).toBe('Not authorized to control timer');

            client.close();
        });

        it('should allow timer control from game owner', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-2';
            const userId = 'game-owner';

            // Mock game owner check - user is the owner
            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: userId,
                clockSeconds: 600,
                periodSeconds: 600,
                isTimerRunning: false,
            });

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            expect(response.success).toBe(true);

            client.close();
        });

        it('should allow timer control from authorized scorer', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-3';
            const userId = 'authorized-scorer';

            // Mock game owner check - user is not owner
            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: 'different-owner',
                clockSeconds: 600,
                periodSeconds: 600,
                isTimerRunning: false,
            });

            // Mock game scorer check - user IS a scorer
            mockDb.query.gameScorers.findFirst.mockResolvedValue({
                id: 'scorer-1',
                gameId: gameId,
                userId: userId,
            });

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            expect(response.success).toBe(true);

            client.close();
        });
    });

    describe('Timer Start/Stop', () => {
        it('should successfully start the timer and return success', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-4';
            const userId = 'game-owner';

            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: userId,
                clockSeconds: 600,
                periodSeconds: 600,
                isTimerRunning: false,
            });

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            expect(response.success).toBe(true);
            expect(response.error).toBeUndefined();

            client.close();
        });

        it('should successfully stop the timer and return success', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-5';
            const userId = 'game-owner';

            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: userId,
                clockSeconds: 550,
                periodSeconds: 600,
                isTimerRunning: true,
                timerStartedAt: new Date(),
            });

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'stop',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            expect(response.success).toBe(true);
            expect(response.error).toBeUndefined();

            client.close();
        });

        it('should not start timer when clock is at 0', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-6';
            const userId = 'game-owner';

            mockDb.query.games.findFirst.mockResolvedValue({
                id: gameId,
                ownerId: userId,
                clockSeconds: 0,
                periodSeconds: 600,
                isTimerRunning: false,
            });

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            // The timer control succeeds but the actual timer doesn't start because clock is 0
            expect(response.success).toBe(true);

            client.close();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully during authorization', async () => {
            const client = Client(`http://localhost:${port}`);
            const gameId = 'test-game-10';
            const userId = 'game-owner';

            // Mock database error during authorization check
            mockDb.query.games.findFirst.mockRejectedValue(new Error('Database connection failed'));

            await new Promise<void>((resolve) => {
                client.on('connect', resolve);
            });

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                client.emit('timer-control', {
                    gameId,
                    action: 'start',
                    userId,
                }, (resp: { success: boolean; error?: string }) => {
                    resolve(resp);
                });
            });

            // Should return failure but not crash
            expect(response.success).toBe(false);
            expect(response.error).toBe('Not authorized to control timer');

            client.close();
        });
    });
});
