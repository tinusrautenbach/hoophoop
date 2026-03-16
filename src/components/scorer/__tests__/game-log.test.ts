import { describe, it, expect } from 'vitest';
import { GameEvent } from '../game-log';

/**
 * Helper to create test events with defaults
 */
function createEvent(overrides: Partial<GameEvent>): GameEvent {
    return {
        id: Math.random().toString(36).slice(2),
        type: 'score',
        team: 'home',
        timestamp: new Date(),
        ...overrides,
    };
}

/**
 * Extracted getShotRatio function from game-log.tsx for testing
 * This matches the implementation in src/components/scorer/game-log.tsx
 */
function getShotRatio(event: GameEvent, allEvents: GameEvent[]): string | null {
    if ((event.type !== 'score' && event.type !== 'miss') || !event.player || !event.value) return null;

    // Secondary sort by id for deterministic ordering when timestamps are equal
    const chronological = [...allEvents].sort(
        (a, b) => (a.timestamp.getTime() - b.timestamp.getTime()) || a.id.localeCompare(b.id)
    );

    const eventIndex = chronological.findIndex((e) => e.id === event.id);
    if (eventIndex === -1) return null;

    const eventsUpToNow = chronological.slice(0, eventIndex + 1);

    const made = eventsUpToNow.filter(
        (e) => e.type === 'score' && e.player === event.player && e.value === event.value
    ).length;

    const attempts = eventsUpToNow.filter(
        (e) =>
            (e.type === 'score' || e.type === 'miss') &&
            e.player === event.player &&
            e.value === event.value
    ).length;

    return `(${made}/${attempts})`;
}

describe('getShotRatio', () => {
    describe('US1: Score Events', () => {
        it('returns null for non-score/miss events', () => {
            const event = createEvent({ type: 'foul', player: 'Player A', value: 1 });
            expect(getShotRatio(event, [event])).toBeNull();
        });

        it('returns null for events without player', () => {
            const event = createEvent({ type: 'score', value: 2, player: undefined });
            expect(getShotRatio(event, [event])).toBeNull();
        });

        it('returns null for events without value', () => {
            const event = createEvent({ type: 'score', player: 'Player A', value: undefined });
            expect(getShotRatio(event, [event])).toBeNull();
        });

        it('returns (1/1) for first made shot', () => {
            const event = createEvent({ type: 'score', player: 'Player A', value: 2 });
            expect(getShotRatio(event, [event])).toBe('(1/1)');
        });

        it('calculates cumulative ratio correctly for score events', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:03:00') }),
            ];
            expect(getShotRatio(events[0], events)).toBe('(1/1)');
            expect(getShotRatio(events[1], events)).toBe('(1/2)');
            expect(getShotRatio(events[2], events)).toBe('(2/3)');
            expect(getShotRatio(events[3], events)).toBe('(2/4)');
        });

        it('separates ratios by shot type (1PT, 2PT, 3PT)', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 1, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:03:00') }),
            ];
            expect(getShotRatio(events[0], events)).toBe('(1/1)'); // 1PT: 1/1
            expect(getShotRatio(events[1], events)).toBe('(1/1)'); // 2PT: 1/1
            expect(getShotRatio(events[2], events)).toBe('(1/2)'); // 2PT: 1/2
            expect(getShotRatio(events[3], events)).toBe('(1/1)'); // 3PT: 1/1
        });
    });

    describe('US2: Miss Events', () => {
        it('returns (0/1) for first missed shot', () => {
            const event = createEvent({ type: 'miss', player: 'Player A', value: 2 });
            expect(getShotRatio(event, [event])).toBe('(0/1)');
        });

        it('calculates cumulative ratio correctly for mixed score/miss events', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:02:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:03:00') }),
            ];
            expect(getShotRatio(events[0], events)).toBe('(1/1)'); // made 1 of 1
            expect(getShotRatio(events[1], events)).toBe('(1/2)'); // made 1 of 2
            expect(getShotRatio(events[2], events)).toBe('(1/3)'); // made 1 of 3
            expect(getShotRatio(events[3], events)).toBe('(2/4)'); // made 2 of 4
        });

        it('separates ratios by player', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'score', player: 'Player B', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
                createEvent({ type: 'score', player: 'Player B', value: 2, timestamp: new Date('2024-01-01T10:03:00') }),
            ];
            expect(getShotRatio(events[0], events)).toBe('(1/1)'); // Player A: 1/1
            expect(getShotRatio(events[1], events)).toBe('(1/1)'); // Player B: 1/1
            expect(getShotRatio(events[2], events)).toBe('(1/2)'); // Player A: 1/2
            expect(getShotRatio(events[3], events)).toBe('(2/2)'); // Player B: 2/2
        });
    });

    describe('US3: Real-Time Updates', () => {
        it('ratio updates when earlier event is deleted', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
            ];
            
            // Before deletion: (2/3)
            expect(getShotRatio(events[2], events)).toBe('(2/3)');
            
            // After deleting second event
            const remainingEvents = [events[0], events[2]];
            expect(getShotRatio(remainingEvents[1], remainingEvents)).toBe('(2/2)');
        });

        it('ratio updates when new event is added', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
            ];
            
            // Initially: (1/1)
            expect(getShotRatio(events[0], events)).toBe('(1/1)');
            
            // Add a miss event
            const newEvent = createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:01:00') });
            events.push(newEvent);
            
            // After adding: (1/2) for the miss
            expect(getShotRatio(events[1], events)).toBe('(1/2)');
            // And the first event ratio is still correct
            expect(getShotRatio(events[0], events)).toBe('(1/1)');
        });

        it('events are sorted chronologically by timestamp then id', () => {
            const sameTimestamp = new Date('2024-01-01T10:00:00');
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: sameTimestamp, id: 'event-a' }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: sameTimestamp, id: 'event-b' }),
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: sameTimestamp, id: 'event-c' }),
            ];
            
            // Events with same timestamp should be sorted by id
            // The chronological order should be: event-a, event-b, event-c
            // So event-a should be (1/1), event-b (1/2), event-c (2/3)
            expect(getShotRatio(events[0], events)).toBe('(1/1)');
            expect(getShotRatio(events[1], events)).toBe('(1/2)');
            expect(getShotRatio(events[2], events)).toBe('(2/3)');
        });
    });

    describe('Edge Cases', () => {
        it('handles empty events array', () => {
            const event = createEvent({ type: 'score', player: 'Player A', value: 2 });
            // Event not in array should return null
            expect(getShotRatio(event, [])).toBeNull();
        });

        it('handles event not in array', () => {
            const event1 = createEvent({ type: 'score', player: 'Player A', value: 2 });
            const event2 = createEvent({ type: 'score', player: 'Player B', value: 2 });
            const events = [event1];
            
            // event2 is not in the events array
            expect(getShotRatio(event2, events)).toBeNull();
        });

        it('handles multiple players with same shot type', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'score', player: 'Player B', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:03:00') }),
            ];
            
            // Player A: score, miss, score → (2/3) on 2PT
            // Player B: score → (1/1) on 2PT
            expect(getShotRatio(events[0], events)).toBe('(1/1)'); // Player A first shot
            expect(getShotRatio(events[1], events)).toBe('(1/1)'); // Player B first shot
            expect(getShotRatio(events[2], events)).toBe('(1/2)'); // Player A miss
            expect(getShotRatio(events[3], events)).toBe('(2/3)'); // Player A second made
        });

        it('handles all miss events for a player', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'miss', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'miss', player: 'Player A', value: 3, timestamp: new Date('2024-01-01T10:02:00') }),
            ];
            
            expect(getShotRatio(events[0], events)).toBe('(0/1)');
            expect(getShotRatio(events[1], events)).toBe('(0/2)');
            expect(getShotRatio(events[2], events)).toBe('(0/3)');
        });

        it('handles all made shots for a player', () => {
            const events: GameEvent[] = [
                createEvent({ type: 'score', player: 'Player A', value: 1, timestamp: new Date('2024-01-01T10:00:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 1, timestamp: new Date('2024-01-01T10:01:00') }),
                createEvent({ type: 'score', player: 'Player A', value: 1, timestamp: new Date('2024-01-01T10:02:00') }),
            ];
            
            expect(getShotRatio(events[0], events)).toBe('(1/1)');
            expect(getShotRatio(events[1], events)).toBe('(2/2)');
            expect(getShotRatio(events[2], events)).toBe('(3/3)');
        });
    });
});