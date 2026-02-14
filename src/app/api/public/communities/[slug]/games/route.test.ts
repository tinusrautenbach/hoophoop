import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { db } from '@/db';

vi.mock('@/db', () => ({
    db: {
        query: {
            communities: {
                findFirst: vi.fn(),
            },
            games: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('Public Community Games API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return games for a valid community slug', async () => {
        const mockCommunity = {
            id: 'comm1',
            name: 'NBA',
            slug: 'nba',
            type: 'league',
        };

        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                homeScore: 100,
                guestScore: 98,
                status: 'live',
                visibility: 'public_general',
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
                homeTeam: { id: 'team3', name: 'Warriors', shortCode: 'GSW', color: '#1D428A' },
                guestTeam: { id: 'team4', name: 'Suns', shortCode: 'PHX', color: '#E56020' },
            },
        ];

        (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);
        (db.query.games.findMany as any).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/communities/nba/games');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nba' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.community).toEqual(mockCommunity);
        expect(data.games).toHaveLength(2);
        expect(data.total).toBe(2);
    });

    it('should return 404 for non-existent community', async () => {
        (db.query.communities.findFirst as any).mockResolvedValue(null);

        const request = new Request('http://localhost/api/public/communities/nonexistent/games');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Community not found');
    });

    it('should filter games by status', async () => {
        const mockCommunity = {
            id: 'comm1',
            name: 'NBA',
            slug: 'nba',
            type: 'league',
        };

        const mockLiveGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'live',
                visibility: 'public_general',
                homeTeam: { id: 'team1', name: 'Lakers' },
                guestTeam: { id: 'team2', name: 'Celtics' },
            },
        ];

        (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);
        (db.query.games.findMany as any).mockResolvedValue(mockLiveGames);

        const request = new Request('http://localhost/api/public/communities/nba/games?status=live');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nba' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
        expect(data.games[0].status).toBe('live');
    });

    it('should search games by team name within community', async () => {
        const mockCommunity = {
            id: 'comm1',
            name: 'NBA',
            slug: 'nba',
            type: 'league',
        };

        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'live',
                visibility: 'public_general',
                homeTeam: { name: 'Lakers' },
                guestTeam: { name: 'Celtics' },
            },
            {
                id: 'game2',
                homeTeamName: 'Warriors',
                guestTeamName: 'Suns',
                status: 'final',
                visibility: 'public_community',
                homeTeam: { name: 'Warriors' },
                guestTeam: { name: 'Suns' },
            },
        ];

        (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);
        (db.query.games.findMany as any).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/communities/nba/games?search=warriors');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nba' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
        expect(data.games[0].homeTeamName).toBe('Warriors');
    });

    it('should return empty games array when community has no public games', async () => {
        const mockCommunity = {
            id: 'comm1',
            name: 'Empty Community',
            slug: 'empty',
            type: 'school',
        };

        (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);
        (db.query.games.findMany as any).mockResolvedValue([]);

        const request = new Request('http://localhost/api/public/communities/empty/games');
        const response = await GET(request, { params: Promise.resolve({ slug: 'empty' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.community).toEqual(mockCommunity);
        expect(data.games).toEqual([]);
        expect(data.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
        (db.query.communities.findFirst as any).mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost/api/public/communities/nba/games');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nba' }) });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch community games');
    });

    it('should handle date range filtering', async () => {
        const mockCommunity = {
            id: 'comm1',
            name: 'NBA',
            slug: 'nba',
            type: 'league',
        };

        const mockGames = [
            {
                id: 'game1',
                homeTeamName: 'Lakers',
                guestTeamName: 'Celtics',
                status: 'final',
                visibility: 'public_general',
                scheduledDate: new Date('2026-02-14'),
                homeTeam: { name: 'Lakers' },
                guestTeam: { name: 'Celtics' },
            },
        ];

        (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);
        (db.query.games.findMany as any).mockResolvedValue(mockGames);

        const request = new Request('http://localhost/api/public/communities/nba/games?dateFrom=2026-02-01&dateTo=2026-02-28');
        const response = await GET(request, { params: Promise.resolve({ slug: 'nba' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.games).toHaveLength(1);
    });
});
