/**
 * Redis Adapter Configuration
 * 
 * Provides Redis adapter support for multi-server Socket.io scaling.
 * Allows the application to scale horizontally across multiple server instances
 * while maintaining real-time event synchronization.
 * 
 * Features:
 * - Redis pub/sub for cross-server event broadcasting
 * - Automatic reconnection with exponential backoff
 * - Connection pooling for high throughput
 */

import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server } from 'socket.io';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

// Connection options
const redisOptions = {
    password: REDIS_PASSWORD || undefined,
    db: REDIS_DB,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
};

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let isAdapterConnected = false;

/**
 * Initialize Redis clients for Socket.io adapter
 */
export async function initializeRedisAdapter(io: Server): Promise<boolean> {
    // Skip if Redis is not configured
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'development') {
        console.log('[Redis] Skipping Redis adapter in development mode (REDIS_URL not set)');
        return false;
    }
    
    try {
        console.log('[Redis] Initializing Redis adapter...');
        
        // Create pub and sub clients
        pubClient = new Redis(REDIS_URL, redisOptions);
        subClient = pubClient.duplicate();
        
        // Handle connection events
        pubClient.on('connect', () => {
            console.log('[Redis] Publisher client connected');
        });
        
        pubClient.on('error', (err) => {
            console.error('[Redis] Publisher client error:', err.message);
        });
        
        subClient.on('connect', () => {
            console.log('[Redis] Subscriber client connected');
        });
        
        subClient.on('error', (err) => {
            console.error('[Redis] Subscriber client error:', err.message);
        });
        
        // Wait for both clients to be ready
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);
        
        // Create and attach adapter
        const adapter = createAdapter(pubClient, subClient);
        io.adapter(adapter);
        
        isAdapterConnected = true;
        console.log('[Redis] Socket.io Redis adapter initialized successfully');
        
        return true;
    } catch (error) {
        console.error('[Redis] Failed to initialize Redis adapter:', error);
        
        // Clean up failed connections
        if (pubClient) {
            await pubClient.quit().catch(() => {});
            pubClient = null;
        }
        if (subClient) {
            await subClient.quit().catch(() => {});
            subClient = null;
        }
        
        return false;
    }
}

/**
 * Check if Redis adapter is connected
 */
export function isRedisAdapterConnected(): boolean {
    return isAdapterConnected && pubClient?.status === 'ready' && subClient?.status === 'ready';
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
    connected: boolean;
    pubStatus: string;
    subStatus: string;
} {
    return {
        connected: isRedisAdapterConnected(),
        pubStatus: pubClient?.status || 'disconnected',
        subStatus: subClient?.status || 'disconnected'
    };
}

/**
 * Gracefully close Redis connections
 */
export async function closeRedisAdapter(): Promise<void> {
    console.log('[Redis] Closing Redis adapter connections...');
    
    isAdapterConnected = false;
    
    const promises: Promise<unknown>[] = [];
    
    if (pubClient) {
        promises.push(
            pubClient.quit().catch(() => {})
        );
        pubClient = null;
    }
    
    if (subClient) {
        promises.push(
            subClient.quit().catch(() => {})
        );
        subClient = null;
    }
    
    await Promise.all(promises);
    console.log('[Redis] Redis adapter connections closed');
}

/**
 * Health check for Redis adapter
 */
export async function checkRedisHealth(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
}> {
    if (!isRedisAdapterConnected() || !pubClient) {
        return {
            healthy: false,
            latency: 0,
            error: 'Redis adapter not connected'
        };
    }
    
    try {
        const start = Date.now();
        await pubClient.ping();
        const latency = Date.now() - start;
        
        return {
            healthy: latency < 100, // Consider healthy if < 100ms
            latency
        };
    } catch (error) {
        return {
            healthy: false,
            latency: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
