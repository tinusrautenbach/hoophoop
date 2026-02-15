/**
 * Socket.io Server - Backward Compatibility Export
 * 
 * This file re-exports from the new modular socket implementation for backward compatibility.
 * All new code should import from './socket/index' directly.
 * 
 * @deprecated Import from './socket/index' instead for new code
 */

// Re-export everything from the new modular implementation
export {
    setupSocket,
    broadcastToPublicGames,
    broadcastToCommunity,
    cleanupTimers,
    cleanupSocketServer,
    metricsCollector
} from './socket/index';

// Type re-exports
export type { SocketMetrics } from './socket/metrics';
export type { RateLimitResult } from './socket/rate-limiter';
