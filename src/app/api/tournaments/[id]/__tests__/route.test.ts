import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '../route';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            tournaments: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: vi.fn(),
                })),
            })),
        })),
        delete: vi.fn(() => ({
            where: vi.fn(),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Tournament Detail API Route', () => {
    const mockTournamentId = 'tour_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return tournament details when authenticated', async () => {
            const mockUserId = 'user_123';
            const mockTournament = {
                id: mockTournamentId,
                name: 'Test Tournament',
                type: 'round_robin',
                status: 'active',
                teams: [],
                games: [],
                pools: [],
                community: { name: 'Test Community' },
            };
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(mockTournament);

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('Test Tournament');
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(null);

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(404);
        });
    });

    describe('PATCH', () => {
        it('should update tournament details', async () => {
            const mockUserId = 'user_123';
            const mockTournament = {
                id: mockTournamentId,
                name: 'Updated Tournament',
                ownerId: mockUserId,
            };
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });

            const updateMock = vi.fn().mockReturnValue([mockTournament]);
            (db.update as any).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: updateMock,
                    }),
                }),
            });

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'Updated Tournament' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );

            expect(response.status).toBe(200);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found or unauthorized', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(null);

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'Updated' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE', () => {
        it('should delete tournament', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );

            expect(response.status).toBe(200);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(null);

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(404);
        });
    });
});