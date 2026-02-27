import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE, PATCH } from '../route';
import { db } from '@/db';
import { games, gameRosters } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { canManageGame } from '@/lib/auth-permissions';

vi.mock('@/db', () => ({
    db: {
        query: {
            games: {
                findFirst: vi.fn(),
            },
            gameEvents: {
                findFirst: vi.fn(),
            },
            gameRosters: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(),
            })),
        })),
        delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
        })),
        update: vi.fn(() => {
            const mockWhere = {
                returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
            };
            const mockSet = {
                where: vi.fn().mockReturnValue(mockWhere),
            };
            return {
                set: vi.fn().mockReturnValue(mockSet),
            };
        }),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/auth-permissions', () => ({
    canManageGame: vi.fn(),
}));

vi.mock('@/lib/activity-logger', () => ({
    logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('Games [id] Events API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ type: 'score', team: 'home', player: 'Player 1' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 403 if game not found or unauthorized', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(false);
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ type: 'score', team: 'home' })
            }), { params: Promise.resolve({ id: 'non-existent' }) });
            expect(response.status).toBe(403);
        });

        it('should return 403 if not game owner', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_other' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(false);
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ type: 'score', team: 'home' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(403);
        });

        it('should allow owner to create score event', async () => {
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true);
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                currentPeriod: 1,
                clockSeconds: 300
            });

            const mockEvent = {
                id: 'event-1',
                gameId: 'game-1',
                type: 'score',
                team: 'home',
                player: 'Player 1',
                value: 2,
                description: '2 pointer by Player 1'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockEvent]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ type: 'score', team: 'home', player: 'Player 1', value: 2 })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.type).toBe('score');
        });

        it('should use game defaults for clock and period', async () => {
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true);
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                currentPeriod: 2,
                clockSeconds: 450
            });

            let insertedValues: Record<string, unknown> = {};
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockImplementation((values) => {
                    insertedValues = values;
                    return {
                        returning: vi.fn().mockResolvedValue([{ id: 'event-1', ...values }]),
                    };
                }),
            });

            await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ type: 'foul', team: 'guest' })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(insertedValues.period).toBe(2);
            expect(insertedValues.clockAt).toBe(450);
        });
    });

    describe('DELETE', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await DELETE(new Request('http://localhost?eventId=event-1'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 400 if eventId is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(400);
        });

        it('should return 403 for unauthorized delete', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_other' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(false);
            (db.query.gameEvents.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'event-1',
                gameId: 'game-1',
                game: { ownerId: 'user_owner' }
            });

            const response = await DELETE(new Request('http://localhost?eventId=event-1'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should allow owner to delete event', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true);
            (db.query.gameEvents.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'event-1',
                gameId: 'game-1',
                game: { ownerId: 'user_owner' }
            });

            const response = await DELETE(new Request('http://localhost?eventId=event-1'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });

            expect(response.status).toBe(200);
            expect(db.delete).toHaveBeenCalled();
        });

        it('should recalculate score when score event is deleted', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            
            // Mock finding the event with its game
            const mockEvent = {
                id: 'event-1',
                gameId: 'game-1',
                type: 'score',
                team: 'home',
                value: 2,
                player: 'Player 1',
                game: { 
                    ownerId: 'user_owner',
                    homeScore: 10,
                    guestScore: 5
                }
            };
            
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true);
            (db.query.gameEvents.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockEvent);

            // Mock finding the roster entry
            (db.query.gameRosters.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'roster-1',
                gameId: 'game-1',
                name: 'Player 1',
                points: 10
            });

            const response = await DELETE(new Request('http://localhost?eventId=event-1'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });

            expect(response.status).toBe(200);
            
            // Should update game score
            expect(db.update).toHaveBeenCalledWith(games);
            // Should update roster points
            expect(db.update).toHaveBeenCalledWith(gameRosters);
        });
    });

    describe('PATCH', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ id: 'event-1', description: 'Updated' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 400 if eventId is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ description: 'Updated' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(400);
        });

        it('should return 403 for unauthorized update', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_other' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(false);
            (db.query.gameEvents.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'event-1',
                gameId: 'game-1',
                game: { ownerId: 'user_owner' }
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ id: 'event-1', description: 'Updated' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(403);
        });

        it('should allow owner to update event', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (canManageGame as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true);
            (db.query.gameEvents.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'event-1',
                gameId: 'game-1',
                game: { ownerId: 'user_owner' }
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ id: 'event-1', description: 'Updated Description', value: 3 })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
        });
    });
});
