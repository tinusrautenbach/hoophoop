/**
 * Socket Server Metrics
 * 
 * Tracks performance metrics for 10K+ concurrent connection support.
 * Provides real-time visibility into connection health, event throughput,
 * and system performance under load.
 */

export interface SocketMetrics {
    // Connection metrics
    totalConnections: number;
    activeConnections: number;
    peakConnections: number;
    connectionsPerSecond: number;
    disconnectionsPerSecond: number;
    
    // Event metrics
    eventsEmitted: number;
    eventsReceived: number;
    eventsPerSecond: number;
    broadcastLatencyMs: number;
    
    // Room metrics
    totalRooms: number;
    roomsPerGame: Map<string, number>;
    
    // Performance metrics
    memoryUsageMB: number;
    cpuUsage: number;
    eventLoopLagMs: number;
    
    // Error metrics
    connectionErrors: number;
    eventErrors: number;
    rateLimitHits: number;
    
    // Timestamps
    lastUpdate: Date;
    startedAt: Date;
}

class MetricsCollector {
    private metrics: SocketMetrics;
    private eventTimestamps: number[] = [];
    private connectionTimestamps: number[] = [];
    private disconnectTimestamps: number[] = [];
    private readonly WINDOW_SIZE_MS = 60000; // 1 minute window
    
    constructor() {
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            peakConnections: 0,
            connectionsPerSecond: 0,
            disconnectionsPerSecond: 0,
            eventsEmitted: 0,
            eventsReceived: 0,
            eventsPerSecond: 0,
            broadcastLatencyMs: 0,
            totalRooms: 0,
            roomsPerGame: new Map(),
            memoryUsageMB: 0,
            cpuUsage: 0,
            eventLoopLagMs: 0,
            connectionErrors: 0,
            eventErrors: 0,
            rateLimitHits: 0,
            lastUpdate: new Date(),
            startedAt: new Date()
        };
        
        // Start periodic cleanup and calculation
        this.startPeriodicUpdates();
    }
    
    private startPeriodicUpdates(): void {
        setInterval(() => {
            this.calculateRates();
            this.updateSystemMetrics();
            this.cleanupOldTimestamps();
            this.metrics.lastUpdate = new Date();
        }, 5000); // Update every 5 seconds
    }
    
    private calculateRates(): void {
        const now = Date.now();
        const windowStart = now - this.WINDOW_SIZE_MS;
        
        // Calculate events per second
        const recentEvents = this.eventTimestamps.filter(t => t > windowStart);
        this.metrics.eventsPerSecond = recentEvents.length / 60;
        
        // Calculate connections per second
        const recentConnections = this.connectionTimestamps.filter(t => t > windowStart);
        this.metrics.connectionsPerSecond = recentConnections.length / 60;
        
        // Calculate disconnections per second
        const recentDisconnects = this.disconnectTimestamps.filter(t => t > windowStart);
        this.metrics.disconnectionsPerSecond = recentDisconnects.length / 60;
    }
    
    private updateSystemMetrics(): void {
        const usage = process.memoryUsage();
        this.metrics.memoryUsageMB = Math.round(usage.heapUsed / 1024 / 1024);
        
        // Measure event loop lag
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const end = process.hrtime.bigint();
            this.metrics.eventLoopLagMs = Number(end - start) / 1000000;
        });
    }
    
    private cleanupOldTimestamps(): void {
        const cutoff = Date.now() - this.WINDOW_SIZE_MS;
        this.eventTimestamps = this.eventTimestamps.filter(t => t > cutoff);
        this.connectionTimestamps = this.connectionTimestamps.filter(t => t > cutoff);
        this.disconnectTimestamps = this.disconnectTimestamps.filter(t => t > cutoff);
    }
    
    // Public methods for tracking
    recordConnection(): void {
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;
        this.connectionTimestamps.push(Date.now());
        
        if (this.metrics.activeConnections > this.metrics.peakConnections) {
            this.metrics.peakConnections = this.metrics.activeConnections;
        }
    }
    
    recordDisconnection(): void {
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        this.disconnectTimestamps.push(Date.now());
    }
    
    recordEventEmitted(count: number = 1): void {
        this.metrics.eventsEmitted += count;
        this.eventTimestamps.push(Date.now());
    }
    
    recordEventReceived(): void {
        this.metrics.eventsReceived++;
    }
    
    recordBroadcastLatency(latencyMs: number): void {
        // Simple moving average
        this.metrics.broadcastLatencyMs = 
            (this.metrics.broadcastLatencyMs * 0.9) + (latencyMs * 0.1);
    }
    
    recordConnectionError(): void {
        this.metrics.connectionErrors++;
    }
    
    recordEventError(): void {
        this.metrics.eventErrors++;
    }
    
    recordRateLimitHit(): void {
        this.metrics.rateLimitHits++;
    }
    
    updateRoomCount(gameId: string, count: number): void {
        this.metrics.roomsPerGame.set(gameId, count);
        this.metrics.totalRooms = this.metrics.roomsPerGame.size;
    }
    
    getMetrics(): SocketMetrics {
        return { ...this.metrics };
    }
    
    getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
        if (this.metrics.activeConnections > 15000) return 'critical';
        if (this.metrics.eventLoopLagMs > 100) return 'critical';
        if (this.metrics.memoryUsageMB > 2048) return 'critical';
        if (this.metrics.activeConnections > 12000) return 'degraded';
        if (this.metrics.eventsPerSecond > 200) return 'degraded';
        if (this.metrics.eventLoopLagMs > 50) return 'degraded';
        return 'healthy';
    }
    
    logMetrics(): void {
        const status = this.getHealthStatus();
        const metrics = this.getMetrics();
        
        console.log(`[Metrics] Status: ${status.toUpperCase()} | ` +
            `Connections: ${metrics.activeConnections} (peak: ${metrics.peakConnections}) | ` +
            `Events/sec: ${metrics.eventsPerSecond.toFixed(1)} | ` +
            `Memory: ${metrics.memoryUsageMB}MB | ` +
            `Latency: ${metrics.broadcastLatencyMs.toFixed(2)}ms | ` +
            `Rate limits: ${metrics.rateLimitHits}`
        );
    }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
