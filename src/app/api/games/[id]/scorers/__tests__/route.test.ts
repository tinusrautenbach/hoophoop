import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            games: {
                findFirst: vi.fn(),
            },
            gameScorers: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
            },
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Games [id] Scorers API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if game not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return 403 if user is not owner or scorer', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_other' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should return scorers for game owner', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { id: 'scorer-1', userId: 'user_owner', role: 'owner' },
                { id: 'scorer-2', userId: 'user_co', role: 'co_scorer' }
            ]);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.length).toBe(2);
        });

        it('should return scorers for authorized scorer', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_co' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'scorer-1',
                userId: 'user_co',
                role: 'co_scorer'
            });
            (db.query.gameScorers.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { id: 'scorer-1', userId: 'user_co', role: 'co_scorer' }
            ]);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'game-1' }) 
            });
            expect(response.status).toBe(200);
        });
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ userId: 'new-scorer' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 400 if userId is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({})
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(400);
        });

        it('should return 403 if non-owner tries to add scorer', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_co' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ userId: 'new-scorer' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(403);
        });

        it('should return 409 if user is already a scorer', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'existing-scorer',
                userId: 'existing-user'
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ userId: 'existing-user' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            expect(response.status).toBe(409);
        });

        it('should allow owner to add new scorer', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const mockScorer = {
                id: 'scorer-1',
                gameId: 'game-1',
                userId: 'new-user',
                role: 'co_scorer'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockScorer]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ userId: 'new-user' })
            }), { params: Promise.resolve({ id: 'game-1' }) });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.userId).toBe('new-user');
        });

        it('should allow owner to specify scorer role', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'game-1',
                ownerId: 'user_owner'
            });
            (db.query.gameScorers.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            let insertedValues: Record<string, unknown> = {};
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockImplementation((values) => {
                    insertedValues = values;
                    return {
                        returning: vi.fn().mockResolvedValue([{ id: 'scorer-1', ...values }]),
                    };
                }),
            });

            await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ userId: 'admin-user', role: 'owner' })
            }), { params: Promise.resolve({ id: 'game-1' }) });

            expect(insertedValues.role).toBe('owner');
        });
    });
});
