import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            tournaments: {
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

describe('Tournaments API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const request = new Request('http://localhost/api/tournaments');
            const response = await GET(request);
            expect(response.status).toBe(401);
        });

        it('should return tournaments when authenticated', async () => {
            const mockUserId = 'user_123';
            const mockTournaments = [
                { id: '1', name: 'Summer Championship', ownerId: mockUserId, status: 'active' }
            ];
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findMany as any).mockReturnValue(mockTournaments);

            const request = new Request('http://localhost/api/tournaments');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockTournaments);
        });

        it('should filter by communityId when provided', async () => {
            const mockUserId = 'user_123';
            const communityId = 'comm_123';
            (auth as any).mockReturnValue({ userId: mockUserId });

            const request = new Request(`http://localhost/api/tournaments?communityId=${communityId}`);
            await GET(request);

            expect(db.query.tournaments.findMany).toHaveBeenCalled();
        });
    });

    describe('POST', () => {
        it('should create a new tournament', async () => {
            const mockUserId = 'user_123';
            const mockTournament = {
                id: '1',
                name: 'Test Tournament',
                type: 'round_robin',
                status: 'scheduled',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                communityId: 'comm_123',
                ownerId: mockUserId,
            };
            (auth as any).mockReturnValue({ userId: mockUserId });

            const insertMock = vi.fn().mockReturnValue([mockTournament]);
            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: insertMock,
                }),
            });

            const request = new Request('http://localhost/api/tournaments', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Test Tournament',
                    type: 'round_robin',
                    startDate: '2026-01-01',
                    endDate: '2026-01-31',
                    communityId: 'comm_123',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe('Test Tournament');
            expect(db.insert).toHaveBeenCalledWith(tournaments);
        });

        it('should return 400 if required fields are missing', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const request = new Request('http://localhost/api/tournaments', {
                method: 'POST',
                body: JSON.stringify({ name: '' }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const request = new Request('http://localhost/api/tournaments', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test' }),
            });

            const response = await POST(request);
            expect(response.status).toBe(401);
        });
    });
});