import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

// Type definitions for mocks
type AuthReturn = { userId: string | null };
type FindManyReturn = unknown[];

vi.mock('@/db', () => ({
    db: {
        query: {
            athletes: {
                findMany: vi.fn(),
            },
        },
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Athletes API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if not authenticated', async () => {
        (auth as unknown as { mockReturnValue: (value: AuthReturn) => void }).mockReturnValue({ userId: null });
        const response = await GET(new Request('http://localhost/api/athletes'));
        expect(response.status).toBe(401);
    });

    it('should return athletes for current user', async () => {
        const mockUserId = 'user_123';
        const mockAthletes = [{ id: 'a1', name: 'Jordan', ownerId: mockUserId }];
        (auth as unknown as { mockReturnValue: (value: AuthReturn) => void }).mockReturnValue({ userId: mockUserId });
        (db.query.athletes.findMany as unknown as { mockReturnValue: (value: FindManyReturn) => void }).mockReturnValue(mockAthletes);

        const response = await GET(new Request('http://localhost/api/athletes'));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockAthletes);
    });

    it('should filter by query parameter', async () => {
        (auth as unknown as { mockReturnValue: (value: AuthReturn) => void }).mockReturnValue({ userId: 'user_123' });
        (db.query.athletes.findMany as unknown as { mockReturnValue: (value: FindManyReturn) => void }).mockReturnValue([]);

        await GET(new Request('http://localhost/api/athletes?q=Jordan'));

        expect(db.query.athletes.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.anything(),
            })
        );
    });
});
