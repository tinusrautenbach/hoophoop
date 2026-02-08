import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import { db } from '@/db';
import { communities, communityMembers, teams, games } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            communities: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ id: 'community-1' }]),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Community [id] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockRequest = (body: any) => new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if community not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return 403 if user is not owner or member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_other' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                name: 'Test Community',
                ownerId: 'user_owner',
                members: [{ userId: 'user_member' }]
            });

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should return community for owner', async () => {
            const mockCommunity = {
                id: 'community-1',
                name: 'My Community',
                ownerId: 'user_123',
                members: [],
                teams: [],
                games: []
            };
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('My Community');
        });

        it('should return community for member', async () => {
            const mockCommunity = {
                id: 'community-1',
                name: 'Community',
                ownerId: 'user_owner',
                members: [{ userId: 'user_123', role: 'scorer' }],
                teams: [],
                games: []
            };
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(200);
        });

        it('should include teams and games in response', async () => {
            const mockCommunity = {
                id: 'community-1',
                name: 'Community',
                ownerId: 'user_123',
                members: [],
                teams: [{ id: 'team-1', name: 'Team A' }],
                games: [{ id: 'game-1', homeTeamName: 'Game 1' }]
            };
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(mockCommunity);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.teams.length).toBe(1);
            expect(data.games.length).toBe(1);
        });
    });

    describe('PATCH', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await PATCH(createMockRequest({ name: 'Updated' }), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if community not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(null);

            const response = await PATCH(createMockRequest({ name: 'Updated' }), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return 403 if non-admin member tries to update', async () => {
            (auth as any).mockReturnValue({ userId: 'user_viewer' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_viewer', role: 'viewer' }]
            });

            const response = await PATCH(createMockRequest({ name: 'Updated' }), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should allow admin to update community name', async () => {
            (auth as any).mockReturnValue({ userId: 'user_admin' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_admin', role: 'admin' }]
            });

            const response = await PATCH(createMockRequest({ name: 'Updated Name', type: 'club' }), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
        });

        it('should allow owner to update community', async () => {
            (auth as any).mockReturnValue({ userId: 'user_owner' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: []
            });

            const response = await PATCH(createMockRequest({ name: 'Owner Update' }), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });

            expect(response.status).toBe(200);
        });
    });
});
