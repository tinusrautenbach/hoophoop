import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            tournaments: {
                findFirst: vi.fn(),
            },
            tournamentTeams: {
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

describe('Tournament Team Detail API Route', () => {
    const mockTournamentId = 'tour_123';
    const mockTeamId = 'team_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PATCH', () => {
        it('should update team seed', async () => {
            const mockUserId = 'user_123';
            const mockTournament = { id: mockTournamentId, ownerId: mockUserId };
            const mockTournamentTeam = { id: '1', tournamentId: mockTournamentId, teamId: mockTeamId, seed: null, poolId: null };
            
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTournament);
            (db.query.tournamentTeams.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTournamentTeam);

            const updateMock = vi.fn().mockReturnValue([{ ...mockTournamentTeam, seed: 3 }]);
            (db.update as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: updateMock,
                    }),
                }),
            });

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ seed: 3 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );

            expect(response.status).toBe(200);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: null });
            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ seed: 3 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );
            expect(response.status).toBe(404);
        });

        it('should return 404 if team not in tournament', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });
            (db.query.tournamentTeams.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const response = await PATCH(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ seed: 3 }),
                }),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE', () => {
        it('should remove team from tournament', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );

            expect(response.status).toBe(200);
        });

        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: null });
            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 if tournament not found', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const response = await DELETE(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams/${mockTeamId}`),
                { params: Promise.resolve({ id: mockTournamentId, teamId: mockTeamId }) }
            );
            expect(response.status).toBe(404);
        });
    });
});