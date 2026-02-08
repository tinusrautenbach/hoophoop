import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { db } from '@/db';
import { communityInvites, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            communityInvites: {
                findFirst: vi.fn(),
            },
            communityMembers: {
                findFirst: vi.fn(),
            },
        },
        transaction: vi.fn((callback) => callback({
            query: {
                communityMembers: {
                    findFirst: vi.fn(),
                },
            },
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue([{ id: 'member-1' }]),
            }),
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ id: 'invite-1' }]),
                }),
            }),
        })),
        update: vi.fn(() => ({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ id: 'invite-1' }]),
            }),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Community Join API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'test-token' })
            }));
            expect(response.status).toBe(401);
        });

        it('should return 400 if token is missing', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({})
            }));
            expect(response.status).toBe(400);
        });

        it('should return 404 for invalid token', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityInvites.findFirst as any).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'invalid-token' })
            }));
            expect(response.status).toBe(404);
        });

        it('should return 400 for expired invite', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityInvites.findFirst as any).mockResolvedValue({
                id: 'invite-1',
                communityId: 'community-1',
                token: 'expired-token',
                status: 'pending',
                expiresAt: new Date(Date.now() - 86400000) // Yesterday
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'expired-token' })
            }));
            expect(response.status).toBe(400);
            expect(db.update).toHaveBeenCalled();
        });

        it('should join community with valid token', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityInvites.findFirst as any).mockResolvedValue({
                id: 'invite-1',
                communityId: 'community-1',
                token: 'valid-token',
                status: 'pending',
                expiresAt: new Date(Date.now() + 86400000), // Tomorrow
                role: 'scorer'
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'valid-token' })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.communityId).toBe('community-1');
        });

        it('should mark invite as accepted after joining', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityInvites.findFirst as any).mockResolvedValue({
                id: 'invite-1',
                communityId: 'community-1',
                token: 'valid-token',
                status: 'pending',
                expiresAt: new Date(Date.now() + 86400000),
                role: 'admin'
            });

            const mockTx = {
                query: {
                    communityMembers: {
                        findFirst: vi.fn().mockResolvedValue(null),
                    },
                },
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue([{ id: 'member-1' }]),
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ id: 'invite-1' }]),
                    }),
                }),
            };
            (db.transaction as any).mockImplementation(async (callback: any) => {
                await callback(mockTx);
            });

            await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'valid-token' })
            }));

            expect(mockTx.update).toHaveBeenCalled();
        });

        it('should not add duplicate member if already joined', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            
            const mockTx = {
                query: {
                    communityMembers: {
                        findFirst: vi.fn().mockResolvedValue({ id: 'existing-member' }),
                    },
                },
                insert: vi.fn(),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ id: 'invite-1' }]),
                    }),
                }),
            };
            (db.transaction as any).mockImplementation(async (callback: any) => {
                await callback(mockTx);
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ token: 'valid-token' })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(mockTx.insert).not.toHaveBeenCalled();
        });
    });
});
