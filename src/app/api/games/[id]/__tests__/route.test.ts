import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            games: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ id: 'game-1' }]),
            })),
        })),
        transaction: vi.fn((callback) => callback({
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ id: 'game-1' }]),
                }),
            }),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Games [id] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return game with rosters and events', async () => {
            const mockGame = {
                id: 'game-1',
                homeTeamName: 'Home Team',
                guestTeamName: 'Guest Team',
                homeScore: 10,
                guestScore: 8,
                status: 'live',
                rosters: [
                    { id: 'roster-1', name: 'Player 1', points: 10 },
                    { id: 'roster-2', name: 'Player 2', points: 0 }
                ],
                events: [
                    { id: 'event-1', type: 'score', description: '2 pointer' }
                ]
            };
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockGame);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.homeTeamName).toBe('Home Team');
            expect(data.rosters.length).toBe(2);
            expect(data.events.length).toBe(1);
        });

        it('should return 404 for non-existent game', async () => {
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });

            expect(response.status).toBe(404);
        });
    });

    describe('PATCH', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ homeScore: 12 })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 404 if game not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ homeScore: 12 })
            }), { params: Promise.resolve({ id: 'non-existent' }) });
            expect(response.status).toBe(404);
        });

        it('should return 403 if non-owner tries to update', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_other' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                rosters: []
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ homeScore: 12 })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(403);
        });

        it('should allow owner to update game score', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                rosters: []
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ homeScore: 15, guestScore: 12 })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(response.status).toBe(200);
        });

        it('should allow owner to update game status', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                status: 'scheduled',
                rosters: []
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ status: 'live' })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(response.status).toBe(200);
        });

        it('should allow owner to update roster player stats', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner',
                rosters: [{ id: 'roster-1' }]
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({
                    rosters: [
                        { id: 'roster-1', points: 20, fouls: 2, isActive: true }
                    ]
                })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(response.status).toBe(200);
            expect(db.transaction).toHaveBeenCalled();
        });
    });
});
