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
            tournamentTeams: {
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

describe('Tournament Teams API Route', () => {
    const mockTournamentId = 'tour_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return teams in tournament', async () => {
            const mockTeams = [
                { id: '1', teamId: 'team_1', team: { name: 'Team A' }, seed: 1, pool: null },
                { id: '2', teamId: 'team_2', team: { name: 'Team B' }, seed: 2, pool: null },
            ];
            (db.query.tournamentTeams.findMany as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTeams);

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockTeams);
            expect(db.query.tournamentTeams.findMany).toHaveBeenCalledWith({
                where: expect.anything(),
                with: { team: true, pool: true }
            });
        });

        it('should return 500 on database error', async () => {
            (db.query.tournamentTeams.findMany as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(new Error('DB error'));

            const response = await GET(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );

            expect(response.status).toBe(500);
        });
    });

    describe('POST', () => {
        it('should add team to tournament', async () => {
            const mockUserId = 'user_123';
            const mockTournament = { id: mockTournamentId, ownerId: mockUserId };
            const mockTournamentTeam = { id: '1', tournamentId: mockTournamentId, teamId: 'team_1', seed: null };
            
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(mockTournament);
            (db.query.tournamentTeams.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const insertMock = vi.fn().mockReturnValue([mockTournamentTeam]);
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: insertMock,
                }),
            });

            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`, {
                    method: 'POST',
                    body: JSON.stringify({ teamId: 'team_1' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.teamId).toBe('team_1');
        });

        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: null });
            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(401);
        });

        it('should return 400 if teamId is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: 'user_123' });
            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(400);
        });

        it('should return 404 if tournament not found', async () => {
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null);

            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`, {
                    method: 'POST',
                    body: JSON.stringify({ teamId: 'team_1' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(404);
        });

        it('should return 400 if team already in tournament', async () => {
            const mockUserId = 'user_123';
            (auth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.tournaments.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ id: mockTournamentId, ownerId: mockUserId });
            (db.query.tournamentTeams.findFirst as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({ id: '1', teamId: 'team_1' });

            const response = await POST(
                new Request(`http://localhost/api/tournaments/${mockTournamentId}/teams`, {
                    method: 'POST',
                    body: JSON.stringify({ teamId: 'team_1' }),
                }),
                { params: Promise.resolve({ id: mockTournamentId }) }
            );
            expect(response.status).toBe(400);
        });
    });
});