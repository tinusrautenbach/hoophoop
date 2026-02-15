import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            teams: {
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

describe('Teams API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value?: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await GET();
            expect(response.status).toBe(401);
        });

        it('should return user teams when authenticated', async () => {
            const mockUserId = 'user_123';
            const mockTeams = [{ id: '1', name: 'Team A', ownerId: mockUserId }];
            (auth as unknown as { mockReturnValue: (value?: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.teams.findMany as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTeams);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockTeams);
            expect(db.query.teams.findMany).toHaveBeenCalled();
        });
    });

    describe('POST', () => {
        it('should create a new team', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value?: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });

            const insertMock = vi.fn().mockReturnValue([{ id: '1', name: 'New Team', ownerId: mockUserId }]);
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: insertMock,
                }),
            });

            const request = new Request('http://localhost/api/teams', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Team' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('New Team');
            expect(db.insert).toHaveBeenCalledWith(teams);
        });

        it('should return 400 if name is missing', async () => {
            (auth as unknown as { mockReturnValue: (value?: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const request = new Request('http://localhost/api/teams', {
                method: 'POST',
                body: JSON.stringify({ name: '' }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });
    });
});
