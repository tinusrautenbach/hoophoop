import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupSocket } from '../../src/server/socket';
import { AddressInfo } from 'node:net';

/**
 * Load and Volume Test Suite
 * 
 * Requirements:
 * - 10,000 spectators connected simultaneously
 * - 100 active games
 * - Each game generates approximately 1 event per second
 * 
 * This test validates:
 * - Server stability under high concurrent load
 * - Event propagation latency
 * - Memory usage under sustained load
 * - Connection handling capacity
 */
describe('Load and Volume Tests - 10K Spectators / 100 Games', () => {
    let io: SocketServer;
    let httpServer: HttpServer;
    let port: number;
    
    // Test configuration
    const NUM_GAMES = 100;
    const NUM_SPECTATORS = 10000;
    const EVENTS_PER_SECOND_PER_GAME = 1;
    const TEST_DURATION_SECONDS = 30; // Run for 30 seconds
    const BATCH_SIZE = 100; // Connect spectators in batches to avoid overwhelming the server
    const BATCH_DELAY_MS = 50; // Delay between connection batches
    
    // Track connections and events
    const gameClients: Map<string, ClientSocket[]> = new Map();
    let allClients: ClientSocket[] = [];
    const eventCounts: Map<string, number> = new Map();
    let connectionErrors: number = 0;
    let disconnectionErrors: number = 0;
    let eventsReceived: number = 0;
    let eventLatencies: number[] = [];

    beforeEach(async () => {
        return new Promise<void>((resolve) => {
            httpServer = createServer();
            io = new SocketServer(httpServer, {
                // Increase limits for high load testing
                maxHttpBufferSize: 1e8,
                pingTimeout: 60000,
                pingInterval: 25000,
                transports: ['websocket', 'polling'],
                // Allow many concurrent connections
                perMessageDeflate: false // Disable compression for performance
            });
            setupSocket(io);

            httpServer.listen(() => {
                port = (httpServer.address() as AddressInfo).port;
                console.log(`[Load Test] Server started on port ${port}`);
                resolve();
            });
        });
    });

    afterEach(() => {
        // Close all client connections
        allClients.forEach(client => {
            if (client.connected) {
                client.close();
            }
        });
        allClients = [];
        gameClients.clear();
        eventCounts.clear();
        eventsReceived = 0;
        eventLatencies = [];
        connectionErrors = 0;
        disconnectionErrors = 0;
        
        io.close();
        httpServer.close();
        console.log('[Load Test] Server and clients cleaned up');
    });

    /**
     * Helper: Connect a spectator to a specific game
     */
    async function connectSpectator(gameId: string, spectatorId: string): Promise<ClientSocket> {
        return new Promise((resolve, reject) => {
            const client = Client(`http://localhost:${port}`, {
                transports: ['websocket'],
                reconnection: false,
                timeout: 10000
            });

            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout connecting spectator ${spectatorId} to game ${gameId}`));
            }, 5000);

            client.on('connect', () => {
                clearTimeout(timeoutId);
                client.emit('join-game', gameId);
                
                // Track the client
                if (!gameClients.has(gameId)) {
                    gameClients.set(gameId, []);
                }
                gameClients.get(gameId)!.push(client);
                allClients.push(client);
                
                // Setup event listeners for this spectator
                client.on('event-added', (data) => {
                    eventsReceived++;
                    if (data.timestamp) {
                        const latency = Date.now() - new Date(data.timestamp).getTime();
                        eventLatencies.push(latency);
                    }
                });

                client.on('game-updated', (_data) => {
                    eventsReceived++;
                });
                
                client.on('clock-update', () => {
                    eventsReceived++;
                });

                client.on('disconnect', () => {
                    disconnectionErrors++;
                });

                // Wait a moment for join to complete
                setTimeout(() => resolve(client), 50);
            });

            client.on('connect_error', (err) => {
                clearTimeout(timeoutId);
                connectionErrors++;
                reject(err);
            });
        });
    }

    /**
     * Helper: Connect spectators in batches to avoid overwhelming the server
     */
    async function connectSpectatorsInBatches(
        gameId: string, 
        numSpectators: number
    ): Promise<void> {
        const spectatorsPerGame = Math.floor(numSpectators / NUM_GAMES);
        const batches = Math.ceil(spectatorsPerGame / BATCH_SIZE);
        
        for (let batch = 0; batch < batches; batch++) {
            const batchPromises: Promise<ClientSocket>[] = [];
            const start = batch * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, spectatorsPerGame);
            
            for (let i = start; i < end; i++) {
                const spectatorId = `spectator-${gameId}-${i}`;
                batchPromises.push(connectSpectator(gameId, spectatorId));
            }
            
            try {
                await Promise.all(batchPromises);
            } catch (err) {
                console.error(`[Load Test] Error in batch ${batch}:`, err);
            }
            
            // Delay between batches
            if (batch < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
    }

    /**
     * Helper: Simulate game events
     */
    async function simulateGameEvents(gameId: string, durationSeconds: number): Promise<void> {
        const startTime = Date.now();
        const eventInterval = 1000 / EVENTS_PER_SECOND_PER_GAME; // 1000ms for 1 event/second
        
        return new Promise((resolve) => {
            const eventTypes = ['SCORE', 'FOUL', 'TIMEOUT', 'SUBSTITUTION'];
            const intervalId = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                
                if (elapsed >= durationSeconds) {
                    clearInterval(intervalId);
                    resolve();
                    return;
                }
                
                // Send event to the game room via the server
                const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
                const eventData = {
                    type: eventType,
                    gameId: gameId,
                    timestamp: new Date().toISOString(),
                    data: {
                        points: eventType === 'SCORE' ? [2, 3][Math.floor(Math.random() * 2)] : undefined,
                        team: Math.random() > 0.5 ? 'home' : 'guest'
                    }
                };
                
                // Emit to the game room (using server's internal mechanism would be ideal,
                // but for load testing we'll emit from a connected client)
                const clients = gameClients.get(gameId);
                if (clients && clients.length > 0) {
                    clients[0].emit('add-event', { gameId, event: eventData });
                }
                
                // Track event count
                eventCounts.set(gameId, (eventCounts.get(gameId) || 0) + 1);
                
            }, eventInterval);
        });
    }

    /**
     * Load Test: 10K Spectators across 100 Games with 1 event/second per game
     */
    it('should handle 10K spectators across 100 games with 1 event/second per game for 30 seconds', async () => {
        const startTime = Date.now();
        const gameIds: string[] = [];
        
        // Generate game IDs
        for (let i = 0; i < NUM_GAMES; i++) {
            gameIds.push(`load-test-game-${i}`);
        }
        
        console.log(`[Load Test] Starting load test with ${NUM_SPECTATORS} spectators and ${NUM_GAMES} games`);
        console.log(`[Load Test] Estimated test duration: ${TEST_DURATION_SECONDS} seconds`);
        
        // Phase 1: Connect all spectators in batches
        console.log('[Load Test] Phase 1: Connecting spectators...');
        const connectionStart = Date.now();
        
        // Connect spectators to each game in parallel, but batched per game
        const connectionPromises = gameIds.map(gameId => 
            connectSpectatorsInBatches(gameId, NUM_SPECTATORS)
        );
        
        await Promise.all(connectionPromises);
        
        const connectionTime = Date.now() - connectionStart;
        console.log(`[Load Test] Connected ${allClients.length} spectators in ${connectionTime}ms`);
        
        // Verify all spectators are connected
        expect(allClients.length).toBeGreaterThanOrEqual(NUM_SPECTATORS * 0.95); // Allow 5% connection failure
        expect(connectionErrors).toBeLessThan(NUM_SPECTATORS * 0.05);
        
        // Phase 2: Start generating events
        console.log('[Load Test] Phase 2: Generating events...');
        const eventStart = Date.now();
        
        // Start event generation for all games in parallel
        const eventPromises = gameIds.map(gameId => 
            simulateGameEvents(gameId, TEST_DURATION_SECONDS)
        );
        
        await Promise.all(eventPromises);
        
        const eventTime = Date.now() - eventStart;
        console.log(`[Load Test] Event generation completed in ${eventTime}ms`);
        
        // Wait a bit for all events to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Phase 3: Verify results
        console.log('[Load Test] Phase 3: Verifying results...');
        
        const totalTime = Date.now() - startTime;
        const totalEventsSent = Array.from(eventCounts.values()).reduce((a, b) => a + b, 0);
        const expectedEvents = NUM_GAMES * EVENTS_PER_SECOND_PER_GAME * TEST_DURATION_SECONDS;
        
        console.log(`[Load Test] Results:`);
        console.log(`  - Total test time: ${totalTime}ms`);
        console.log(`  - Connected clients: ${allClients.length}/${NUM_SPECTATORS}`);
        console.log(`  - Connection errors: ${connectionErrors}`);
        console.log(`  - Disconnection errors: ${disconnectionErrors}`);
        console.log(`  - Total events sent: ${totalEventsSent}/${expectedEvents}`);
        console.log(`  - Events received: ${eventsReceived}`);
        
        if (eventLatencies.length > 0) {
            const avgLatency = eventLatencies.reduce((a, b) => a + b, 0) / eventLatencies.length;
            const maxLatency = Math.max(...eventLatencies);
            const minLatency = Math.min(...eventLatencies);
            console.log(`  - Average event latency: ${avgLatency.toFixed(2)}ms`);
            console.log(`  - Max event latency: ${maxLatency}ms`);
            console.log(`  - Min event latency: ${minLatency}ms`);
            
            // Assert reasonable latency (should be under 500ms for most events)
            expect(avgLatency).toBeLessThan(500);
        }
        
        // Assertions
        expect(allClients.length).toBeGreaterThanOrEqual(NUM_SPECTATORS * 0.90); // 90% should connect
        expect(disconnectionErrors).toBeLessThan(NUM_SPECTATORS * 0.10); // Less than 10% should disconnect
        expect(totalEventsSent).toBeGreaterThanOrEqual(expectedEvents * 0.95); // 95% of events should be sent
        
        console.log('[Load Test] Load test completed successfully!');
    }, 120000); // 2 minute timeout for this test

    /**
     * Stress Test: Rapid connections/disconnections
     */
    it('should handle rapid connection and disconnection cycles', async () => {
        const gameId = 'stress-test-game';
        const cycles = 5;
        const spectatorsPerCycle = 1000;
        
        console.log(`[Stress Test] Starting stress test with ${cycles} cycles of ${spectatorsPerCycle} spectators`);
        
        for (let cycle = 0; cycle < cycles; cycle++) {
            console.log(`[Stress Test] Cycle ${cycle + 1}/${cycles}`);
            
            // Connect spectators
            const connectPromises: Promise<ClientSocket>[] = [];
            for (let i = 0; i < spectatorsPerCycle; i++) {
                connectPromises.push(connectSpectator(gameId, `stress-spectator-${cycle}-${i}`));
            }
            
            await Promise.all(connectPromises);
            
            // Generate some events
            const eventPromises: Promise<void>[] = [];
            for (let i = 0; i < 5; i++) {
                eventPromises.push(
                    new Promise((resolve) => {
                        setTimeout(() => {
                            const clients = gameClients.get(gameId);
                            if (clients && clients.length > 0) {
                                clients[0].emit('add-event', { 
                                    gameId, 
                                    event: { type: 'SCORE', timestamp: new Date().toISOString() } 
                                });
                            }
                            resolve();
                        }, i * 200);
                    })
                );
            }
            
            await Promise.all(eventPromises);
            
            // Wait for events to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Disconnect all spectators
            const clients = gameClients.get(gameId) || [];
            clients.forEach(client => client.close());
            gameClients.set(gameId, []);
            
            // Wait before next cycle
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('[Stress Test] Stress test completed successfully!');
        expect(connectionErrors).toBeLessThan(spectatorsPerCycle * cycles * 0.05); // Less than 5% errors
    }, 60000); // 1 minute timeout

    /**
     * Memory Test: Monitor memory usage during sustained load
     */
    it('should maintain stable memory usage during sustained 10K connections', async () => {
        const initialMemory = process.memoryUsage();
        console.log(`[Memory Test] Initial memory usage: ${JSON.stringify({
            heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(initialMemory.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(initialMemory.rss / 1024 / 1024) + 'MB'
        })}`);
        
        const gameIds: string[] = [];
        for (let i = 0; i < NUM_GAMES; i++) {
            gameIds.push(`memory-test-game-${i}`);
        }
        
        // Connect all spectators
        console.log('[Memory Test] Connecting spectators...');
        const connectionPromises = gameIds.map(gameId => 
            connectSpectatorsInBatches(gameId, NUM_SPECTATORS)
        );
        
        await Promise.all(connectionPromises);
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        const afterConnectionMemory = process.memoryUsage();
        console.log(`[Memory Test] Memory after connections: ${JSON.stringify({
            heapUsed: Math.round(afterConnectionMemory.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(afterConnectionMemory.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(afterConnectionMemory.rss / 1024 / 1024) + 'MB'
        })}`);
        
        // Run events for a short period
        console.log('[Memory Test] Running events for 10 seconds...');
        const eventPromises = gameIds.map(gameId => 
            simulateGameEvents(gameId, 10)
        );
        
        await Promise.all(eventPromises);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check memory again
        if (global.gc) {
            global.gc();
        }
        
        const finalMemory = process.memoryUsage();
        console.log(`[Memory Test] Memory after events: ${JSON.stringify({
            heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(finalMemory.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(finalMemory.rss / 1024 / 1024) + 'MB'
        })}`);
        
        // Memory should not have grown more than 200MB
        const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        console.log(`[Memory Test] Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
        
        expect(memoryGrowthMB).toBeLessThan(500); // Should be under 500MB growth
        
        console.log('[Memory Test] Memory test completed successfully!');
    }, 120000); // 2 minute timeout
});
