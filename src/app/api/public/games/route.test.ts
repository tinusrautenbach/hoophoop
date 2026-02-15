import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { db } from '@/db';

vi.mock('@/db', () => ({
    db: {
        query: {
            games: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('Public Games API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return public games without authentication', async () => {
        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                homeScore: 100,
                guestScore: 98,
                status: 'live',
                visibility: 'public_general',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
                homeTeam: { id: 'team1', name: 'Lakers', shortCode: 'LAL', color: '#552583' },
                guestTeam: { id: 'team2', name: 'Celtics', shortCode: 'BOS', color: '#007A33' },
            },
            {
                id: 'game2',
                homeTeamName: 'Warriors',
                guestTeamName: 'Suns',
                homeScore: 95,
                guestScore: 102,
                status: 'final',
                visibility: 'public_community',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
                homeTeam: { id: 'team3', name: 'Warriors', shortCode: 'GSW', color: '#1D428A' },
                guestTeam: { id: 'team4', name: 'Suns', shortCode: 'PHX', color: '#E56020' },
            },
        ];

        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/games');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(2);
        expect(data.total).toBe(2);
        expect(data.groupedByCommunity).toHaveLength(1);
        expect(data.groupedByCommunity[0].community.name).toBe('NBA');
    });

    it('should filter games by status', async () => {
        const mockLiveGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'live',
                visibility: 'public_general',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
            },
        ];

        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockLiveGames);

        const request = new Request('http://localhost/api/public/games?status=live');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
        expect(data.games[0].status).toBe('live');
    });

    it('should filter games by communityId', async () => {
        const mockCommunityGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'live',
                visibility: 'public_general',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
            },
        ];

        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockCommunityGames);

        const request = new Request('http://localhost/api/public/games?communityId=comm1');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(db.query.games.findMany).toHaveBeenCalled();
    });

    it('should search games by team name', async () => {
        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'live',
                visibility: 'public_general',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
                homeTeam: { name: 'Lakers' },
                guestTeam: { name: 'Celtics' },
            },
            {
                id: 'game2',
                homeTeamName: 'Warriors',
                guestTeamName: 'Suns',
                status: 'final',
                visibility: 'public_community',
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
                homeTeam: { name: 'Warriors' },
                guestTeam: { name: 'Suns' },
            },
        ];

        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/games?search=lakers');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
        expect(data.games[0].homeTeamName).toBe('Lakers');
    });

    it('should return empty array when no public games exist', async () => {
        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([]);

        const request = new Request('http://localhost/api/public/games');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toEqual([]);
        expect(data.total).toBe(0);
        expect(data.groupedByCommunity).toEqual([]);
    });

    it('should handle date range filtering', async () => {
        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'final',
                visibility: 'public_general',
                scheduledDate: new Date('2026-02-14'),
                community: { id: 'comm1', name: 'NBA', slug: 'nba' },
            },
        ];

        (db.query.games.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/games?dateFrom=2026-02-01&dateTo=2026-02-28');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
    });

    it('should handle database errors gracefully', async () => {
        (db.query.games.findMany as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost/api/public/games');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch public games');
    });
});
