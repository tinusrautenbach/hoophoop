import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '../route';
import { db } from '@/db';
import { tournamentGames, tournaments, games } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            tournaments: {
                findFirst: vi.fn(),
            },
            tournamentGames: {
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

describe('Tournament Game Detail API Route', () => {
    const mockTournamentId = 'tour_123';
    const mockGameId = 'game_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PATCH - Manual Score Entry', () => {
        it('should update game score', async () => {
            const mockUserId = 'user_123';
            const mockTournament = { id: mockTournamentId, ownerId: mockUserId };
            const mockTournamentGame = { id: '1', tournamentId: mockTournamentId, gameId: mockGameId };
            const mockUpdatedGame = { id: mockGameId, homeScore: 85, guestScore: 72, status: 'final' };
            
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(mockTournament);
            (db.query.tournamentGames.findFirst as any).mockReturnValue(mockTournamentGame);

            const updateMock = vi.fn().mockReturnValue([mockUpdatedGame]);
            (db.update as any).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: updateMock,
                    }),
                }),
            });

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}/score`, {
                    method: 'PATCH',
                    body: JSON.stringify({ homeScore: 85, guestScore: 72 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.homeScore).toBe(85);
            expect(data.guestScore).toBe(72);
            expect(data.status).toBe('final');
        });

        it('should return 400 if scores are missing', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}/score`, {
                    method: 'PATCH',
                    body: JSON.stringify({}),
                }),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(400);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}/score`),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(null);

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}/score`, {
                    method: 'PATCH',
                    body: JSON.stringify({ homeScore: 85, guestScore: 72 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(404);
        });

        it('should return 404 if game not in tournament', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });
            (db.query.tournamentGames.findFirst as any).mockReturnValue(null);

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}/score`, {
                    method: 'PATCH',
                    body: JSON.stringify({ homeScore: 85, guestScore: 72 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE', () => {
        it('should remove game from tournament', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}`),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );

            expect(response.status).toBe(200);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}`),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as any).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as any).mockReturnValue(null);

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games/${mockGameId}`),
                { params: Promise.resolve({ id: mockTournamentId, gameId: mockGameId }) }
            );
            expect(response.status).toBe(404);
        });
    });
});