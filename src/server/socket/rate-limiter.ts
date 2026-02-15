/**
 * Socket Connection Rate Limiter
 * 
 * Implements rate limiting for WebSocket connections and events to prevent
 * abuse and ensure fair usage under high load (10K+ connections).
 * 
 * Features:
 * - Connection rate limiting per IP
 * - Event rate limiting per socket
 * - Rate limiting per game room
 * - Automatic cleanup of stale entries
 */

import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

// Connection rate limiter - per IP
// Allow 10 connections per 10 seconds per IP (to prevent connection flooding)
const connectionLimiter = new RateLimiterMemory({
    keyPrefix: 'socket_connection',
    points: 10, // 10 connections
    duration: 10, // per 10 seconds
});

// Event rate limiter - per socket
// Allow 60 events per minute per socket (1 per second on average)
const eventLimiter = new RateLimiterMemory({
    keyPrefix: 'socket_event',
    points: 60, // 60 events
    duration: 60, // per 60 seconds
});

// Game room event limiter - per game
// Allow 120 events per minute per game (2 per second on average)
const gameEventLimiter = new RateLimiterMemory({
    keyPrefix: 'game_event',
    points: 120, // 120 events
    duration: 60, // per 60 seconds
});

// Burst limiter for specific event types (prevent spam)
// Allow 10 burst events per 5 seconds
const burstLimiter = new RateLimiterMemory({
    keyPrefix: 'burst_event',
    points: 10,
    duration: 5,
});

export interface RateLimitResult {
    allowed: boolean;
    remainingPoints: number;
    msBeforeNext: number;
    consumedPoints: number;
}

export class SocketRateLimiter {
    
    /**
     * Check if a new connection is allowed from this IP
     */
    async checkConnectionAllowed(ip: string): Promise<RateLimitResult> {
        try {
            const result = await connectionLimiter.consume(ip);
            return {
                allowed: true,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
                consumedPoints: result.consumedPoints
            };
        } catch (rejRes) {
            if (rejRes instanceof RateLimiterRes) {
                return {
                    allowed: false,
                    remainingPoints: 0,
                    msBeforeNext: rejRes.msBeforeNext,
                    consumedPoints: rejRes.consumedPoints
                };
            }
            // If not a rate limit error, allow but log
            console.error('[RateLimiter] Unexpected error:', rejRes);
            return {
                allowed: true,
                remainingPoints: 0,
                msBeforeNext: 0,
                consumedPoints: 0
            };
        }
    }
    
    /**
     * Check if an event is allowed from this socket
     */
    async checkEventAllowed(socketId: string): Promise<RateLimitResult> {
        try {
            const result = await eventLimiter.consume(socketId);
            return {
                allowed: true,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
                consumedPoints: result.consumedPoints
            };
        } catch (rejRes) {
            if (rejRes instanceof RateLimiterRes) {
                return {
                    allowed: false,
                    remainingPoints: 0,
                    msBeforeNext: rejRes.msBeforeNext,
                    consumedPoints: rejRes.consumedPoints
                };
            }
            return {
                allowed: true,
                remainingPoints: 0,
                msBeforeNext: 0,
                consumedPoints: 0
            };
        }
    }
    
    /**
     * Check if an event is allowed for this game
     */
    async checkGameEventAllowed(gameId: string): Promise<RateLimitResult> {
        try {
            const result = await gameEventLimiter.consume(gameId);
            return {
                allowed: true,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
                consumedPoints: result.consumedPoints
            };
        } catch (rejRes) {
            if (rejRes instanceof RateLimiterRes) {
                return {
                    allowed: false,
                    remainingPoints: 0,
                    msBeforeNext: rejRes.msBeforeNext,
                    consumedPoints: rejRes.consumedPoints
                };
            }
            return {
                allowed: true,
                remainingPoints: 0,
                msBeforeNext: 0,
                consumedPoints: 0
            };
        }
    }
    
    /**
     * Check burst rate for high-frequency events (e.g., timer ticks)
     */
    async checkBurstAllowed(key: string): Promise<RateLimitResult> {
        try {
            const result = await burstLimiter.consume(key);
            return {
                allowed: true,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
                consumedPoints: result.consumedPoints
            };
        } catch (rejRes) {
            if (rejRes instanceof RateLimiterRes) {
                return {
                    allowed: false,
                    remainingPoints: 0,
                    msBeforeNext: rejRes.msBeforeNext,
                    consumedPoints: rejRes.consumedPoints
                };
            }
            return {
                allowed: true,
                remainingPoints: 0,
                msBeforeNext: 0,
                consumedPoints: 0
            };
        }
    }
    
    /**
     * Reset rate limits for a specific IP (e.g., after successful auth)
     */
    async resetConnectionLimit(ip: string): Promise<void> {
        await connectionLimiter.delete(ip);
    }
    
    /**
     * Reset rate limits for a specific socket
     */
    async resetEventLimit(socketId: string): Promise<void> {
        await eventLimiter.delete(socketId);
    }
    
    /**
     * Get current rate limit status for monitoring
     */
    getStatus(): {
        connectionsTracked: number;
        eventsTracked: number;
        gamesTracked: number;
    } {
        return {
            connectionsTracked: connectionLimiter.points,
            eventsTracked: eventLimiter.points,
            gamesTracked: gameEventLimiter.points
        };
    }
}

// Export singleton instance
export const socketRateLimiter = new SocketRateLimiter();
