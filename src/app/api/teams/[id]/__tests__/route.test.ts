import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import { db } from '@/db';
import { teams, communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';

const mockTeam = {
    id: 'team-1',
    name: 'Test Team',
    communityId: null,
    community: null
};

vi.mock('@/db', () => ({
    db: {
        query: {
            teams: {
                findFirst: vi.fn(),
            },
            communities: {
                findFirst: vi.fn(),
            },
            communityMembers: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockTeam]),
                }),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Teams [id] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if team not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return team with community', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue({
                ...mockTeam,
                community: { id: 'community-1', name: 'Test Community' }
            });

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('Test Team');
            expect(data.community).toBeDefined();
        });
    });

    describe('PATCH - Update Team', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated' })
            }), { params: Promise.resolve({ id: 'team-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 404 if team not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated' })
            }), { params: Promise.resolve({ id: 'non-existent' }) });
            expect(response.status).toBe(404);
        });

        it('should update team name', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(mockTeam);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'New Name' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
        });

        it('should return 404 if community not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(mockTeam);
            (db.query.communities.findFirst as any).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ communityId: 'non-existent' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(404);
        });

        it('should return 403 if not community admin', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(mockTeam);
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                name: 'Test Community'
            });
            (db.query.communityMembers.findFirst as any).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ communityId: 'community-1' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(403);
        });

        it('should assign team to community if admin', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue(mockTeam);
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                name: 'Test Community'
            });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                id: 'membership-1',
                userId: 'user_123',
                role: 'admin'
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ communityId: 'community-1' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(200);
        });

        it('should remove team from community', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.teams.findFirst as any).mockResolvedValue({
                ...mockTeam,
                communityId: 'community-1'
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ communityId: null })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(200);
        });
    });
});
