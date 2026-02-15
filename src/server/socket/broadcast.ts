/**
 * Optimized Broadcasting System
 * 
 * Implements message batching and optimized broadcasting for 10K+ connections.
 * Batches multiple events together to reduce network overhead and improve throughput.
 * 
 * Features:
 * - Message batching (groups small messages)
 * - Priority queuing (timer updates vs game events)
 * - Compression hints
 * - Adaptive batch sizing based on load
 */

import { Server } from "socket.io";
import { metricsCollector } from "./metrics";

interface BatchedMessage {
    event: string;
    data: unknown;
    priority: 'high' | 'normal' | 'low';
    timestamp: number;
    gameId?: string;
}

interface BroadcastQueue {
    messages: BatchedMessage[];
    lastFlush: number;
    flushInterval: number;
}

export class OptimizedBroadcaster {
    private io: Server | null = null;
    private queues: Map<string, BroadcastQueue> = new Map();
    private highPriorityFlushMs = 16; // ~60fps for timer updates
    private normalPriorityFlushMs = 50; // 20fps for normal events
    private lowPriorityFlushMs = 100; // 10fps for non-critical updates
    private maxBatchSize = 50; // Max messages per batch
    private isRunning = false;
    private flushIntervals: Map<string, NodeJS.Timeout> = new Map();
    
    constructor() {
        // Start the flush loop
        this.startFlushLoop();
    }
    
    initialize(io: Server): void {
        this.io = io;
    }
    
    /**
     * Queue a message for batched broadcasting
     */
    queueBroadcast(
        room: string,
        event: string,
        data: unknown,
        priority: 'high' | 'normal' | 'low' = 'normal',
        gameId?: string
    ): void {
        if (!this.queues.has(room)) {
            this.queues.set(room, {
                messages: [],
                lastFlush: Date.now(),
                flushInterval: this.getFlushInterval(priority)
            });
        }
        
        const queue = this.queues.get(room)!;
        queue.messages.push({
            event,
            data,
            priority,
            timestamp: Date.now(),
            gameId
        });
        
        // Check if we should flush immediately
        const now = Date.now();
        const timeSinceLastFlush = now - queue.lastFlush;
        
        if (queue.messages.length >= this.maxBatchSize || 
            timeSinceLastFlush >= this.getFlushInterval(priority)) {
            this.flushQueue(room);
        }
    }
    
    /**
     * Immediate broadcast for critical events (no batching)
     */
    broadcastImmediate(room: string, event: string, data: unknown): void {
        if (!this.io) return;
        
        const start = Date.now();
        this.io.to(room).emit(event, data);
        const latency = Date.now() - start;
        
        metricsCollector.recordBroadcastLatency(latency);
        metricsCollector.recordEventEmitted();
    }
    
    /**
     * Broadcast to multiple rooms efficiently
     */
    broadcastToRooms(
        rooms: string[],
        event: string,
        data: unknown,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): void {
        rooms.forEach(room => {
            this.queueBroadcast(room, event, data, priority);
        });
    }
    
    /**
     * Flush a specific queue immediately
     */
    private flushQueue(room: string): void {
        if (!this.io) return;
        
        const queue = this.queues.get(room);
        if (!queue || queue.messages.length === 0) return;
        
        const messages = queue.messages.splice(0, this.maxBatchSize);
        queue.lastFlush = Date.now();
        
        // Separate by priority
        const highPriority = messages.filter(m => m.priority === 'high');
        const normalPriority = messages.filter(m => m.priority === 'normal');
        const lowPriority = messages.filter(m => m.priority === 'low');
        
        // Send high priority immediately
        if (highPriority.length > 0) {
            const start = Date.now();
            if (highPriority.length === 1) {
                this.io.to(room).emit(highPriority[0].event, highPriority[0].data);
            } else {
                this.io.to(room).emit('batch-update', {
                    timestamp: Date.now(),
                    messages: highPriority
                });
            }
            metricsCollector.recordBroadcastLatency(Date.now() - start);
            metricsCollector.recordEventEmitted(highPriority.length);
        }
        
        // Batch normal priority
        if (normalPriority.length > 0) {
            const start = Date.now();
            if (normalPriority.length === 1) {
                this.io.to(room).emit(normalPriority[0].event, normalPriority[0].data);
            } else {
                this.io.to(room).emit('batch-update', {
                    timestamp: Date.now(),
                    messages: normalPriority
                });
            }
            metricsCollector.recordBroadcastLatency(Date.now() - start);
            metricsCollector.recordEventEmitted(normalPriority.length);
        }
        
        // Batch low priority (or drop if too old)
        if (lowPriority.length > 0) {
            const now = Date.now();
            const recentLowPriority = lowPriority.filter(m => (now - m.timestamp) < 500);
            
            if (recentLowPriority.length > 0) {
                const start = Date.now();
                if (recentLowPriority.length === 1) {
                    this.io.to(room).emit(recentLowPriority[0].event, recentLowPriority[0].data);
                } else {
                    this.io.to(room).emit('batch-update', {
                        timestamp: Date.now(),
                        messages: recentLowPriority
                    });
                }
                metricsCollector.recordBroadcastLatency(Date.now() - start);
                metricsCollector.recordEventEmitted(recentLowPriority.length);
            }
        }
    }
    
    /**
     * Start the periodic flush loop
     */
    private startFlushLoop(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        
        // High priority flush loop (every 16ms for timer updates)
        const highPriorityInterval = setInterval(() => {
            this.flushAllQueues('high');
        }, this.highPriorityFlushMs);
        
        // Normal priority flush loop
        const normalPriorityInterval = setInterval(() => {
            this.flushAllQueues('normal');
        }, this.normalPriorityFlushMs);
        
        // Low priority flush loop
        const lowPriorityInterval = setInterval(() => {
            this.flushAllQueues('low');
        }, this.lowPriorityFlushMs);
        
        this.flushIntervals.set('high', highPriorityInterval);
        this.flushIntervals.set('normal', normalPriorityInterval);
        this.flushIntervals.set('low', lowPriorityInterval);
    }
    
    /**
     * Flush all queues of a specific priority
     */
    private flushAllQueues(priority: 'high' | 'normal' | 'low'): void {
        this.queues.forEach((queue, room) => {
            const now = Date.now();
            const timeSinceLastFlush = now - queue.lastFlush;
            const flushInterval = this.getFlushInterval(priority);
            
            // Check if any messages of this priority exist
            const hasPriorityMessages = queue.messages.some(m => m.priority === priority);
            
            if (hasPriorityMessages && timeSinceLastFlush >= flushInterval) {
                this.flushQueue(room);
            }
        });
    }
    
    /**
     * Get flush interval based on priority
     */
    private getFlushInterval(priority: 'high' | 'normal' | 'low'): number {
        switch (priority) {
            case 'high': return this.highPriorityFlushMs;
            case 'normal': return this.normalPriorityFlushMs;
            case 'low': return this.lowPriorityFlushMs;
        }
    }
    
    /**
     * Adapt batch size based on current load
     */
    adaptToLoad(activeConnections: number): void {
        // Reduce batch sizes under heavy load to maintain responsiveness
        if (activeConnections > 8000) {
            this.maxBatchSize = 20;
            this.normalPriorityFlushMs = 25;
        } else if (activeConnections > 5000) {
            this.maxBatchSize = 30;
            this.normalPriorityFlushMs = 35;
        } else {
            this.maxBatchSize = 50;
            this.normalPriorityFlushMs = 50;
        }
    }
    
    /**
     * Get queue statistics for monitoring
     */
    getStats(): {
        totalQueues: number;
        totalQueuedMessages: number;
        avgQueueSize: number;
    } {
        let totalMessages = 0;
        this.queues.forEach(queue => {
            totalMessages += queue.messages.length;
        });
        
        const queueCount = this.queues.size;
        return {
            totalQueues: queueCount,
            totalQueuedMessages: totalMessages,
            avgQueueSize: queueCount > 0 ? totalMessages / queueCount : 0
        };
    }
    
    /**
     * Stop the broadcaster and flush all queues
     */
    stop(): void {
        this.isRunning = false;
        
        // Clear all intervals
        this.flushIntervals.forEach(interval => clearInterval(interval));
        this.flushIntervals.clear();
        
        // Flush all remaining queues
        this.queues.forEach((_, room) => this.flushQueue(room));
        this.queues.clear();
    }
}

// Export singleton instance
export const optimizedBroadcaster = new OptimizedBroadcaster();
