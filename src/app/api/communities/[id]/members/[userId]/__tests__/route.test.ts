import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../route';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            communities: {
                findFirst: vi.fn(),
            },
        },
        delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ id: 'member-1' }]),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Community Members [userId] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('DELETE', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'target-user' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if community not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as any).mockResolvedValue(null);

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent', userId: 'target-user' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return 403 if unauthorized tries to remove member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_other' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_viewer', role: 'viewer' }]
            });

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'target-user' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should allow admin to remove non-owner member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_admin' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [
                    { userId: 'user_admin', role: 'admin' },
                    { userId: 'user_scorer', role: 'scorer' }
                ]
            });

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'user_scorer' }) 
            });

            expect(response.status).toBe(200);
            expect(db.delete).toHaveBeenCalled();
        });

        it('should allow owner to remove any member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_owner' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_admin', role: 'admin' }]
            });

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'user_admin' }) 
            });

            expect(response.status).toBe(200);
        });

        it('should allow user to remove themselves', async () => {
            (auth as any).mockReturnValue({ userId: 'user_scorer' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [
                    { userId: 'user_owner', role: 'admin' },
                    { userId: 'user_scorer', role: 'scorer' }
                ]
            });

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'user_scorer' }) 
            });

            expect(response.status).toBe(200);
        });

        it('should return 403 when trying to remove owner', async () => {
            (auth as any).mockReturnValue({ userId: 'user_admin' });
            (db.query.communities.findFirst as any).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [
                    { userId: 'user_owner', role: 'admin' },
                    { userId: 'user_admin', role: 'admin' }
                ]
            });

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1', userId: 'user_owner' }) 
            });

            expect(response.status).toBe(403);
        });
    });
});
