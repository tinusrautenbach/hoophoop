import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            tournaments: {
                findFirst: vi.fn(),
            },
            tournamentGames: {
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

describe('Tournament Games API Route', () => {
    const mockTournamentId = 'tour_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return games in tournament', async () => {
            const mockGames = [
                { id: '1', gameId: 'game_1', game: { homeTeamName: 'Team A', guestTeamName: 'Team B' }, isPoolGame: true },
                { id: '2', gameId: 'game_2', game: { homeTeamName: 'Team C', guestTeamName: 'Team D' }, isPoolGame: false },
            ];
            (db.query.tournamentGames.findMany as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockGames);

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockGames);
        });

        it('should return 500 on database error', async () => {
            (db.query.tournamentGames.findMany as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(new Error('DB error'));

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );

            expect(response.status).toBe(500);
        });
    });

    describe('POST', () => {
        it('should link existing game to tournament', async () => {
            const mockUserId = 'user_123';
            const mockTournament = { id: mockTournamentId, ownerId: mockUserId, communityId: 'comm_123' };
            const mockTournamentGame = { id: '1', tournamentId: mockTournamentId, gameId: 'game_1', isPoolGame: true };
            
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTournament);

            const insertMock = vi.fn().mockReturnValue([mockTournamentGame]);
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: insertMock,
                }),
            });

            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games`, {
                    method: 'POST',
                    body: JSON.stringify({ gameId: 'game_1', isPoolGame: true }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.gameId).toBe('game_1');
        });

        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: null });
            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/games`, {
                    method: 'POST',
                    body: JSON.stringify({ gameId: 'game_1' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(404);
        });
    });
});