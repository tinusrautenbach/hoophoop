import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            communities: {
                findFirst: vi.fn(),
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

describe('Community Invite API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 400 if email is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({})
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(400);
        });

        it('should return 404 if community not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.communities.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com' })
            }), { params: Promise.resolve({ id: 'non-existent' }) });
            expect(response.status).toBe(404);
        });

        it('should return 403 if non-admin tries to invite', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_scorer' });
            (db.query.communities.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_scorer', role: 'scorer' }]
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(403);
        });

        it('should allow admin to create invite', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_admin' });
            (db.query.communities.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_admin', role: 'admin' }]
            });

            const mockInvite = {
                id: 'invite-1',
                communityId: 'community-1',
                email: 'new@example.com',
                role: 'scorer',
                token: 'test-token-123',
                status: 'pending'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockInvite]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'new@example.com' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.invite.email).toBe('new@example.com');
            expect(data.inviteLink).toContain('token=');
        });

        it('should allow owner to create invite', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_owner' });
            (db.query.communities.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: []
            });

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        id: 'invite-1',
                        communityId: 'community-1',
                        email: 'owner@example.com',
                        token: 'owner-token'
                    }]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'owner@example.com', role: 'admin' })
            }), { params: Promise.resolve({ id: 'community-1' }) });

            expect(response.status).toBe(200);
        });

        it('should default role to scorer if not specified', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_admin' });
            (db.query.communities.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'community-1',
                ownerId: 'user_owner',
                members: [{ userId: 'user_admin', role: 'admin' }]
            });

            let insertedValues: Record<string, unknown> = {};
            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockImplementation((values) => {
                    insertedValues = values;
                    return {
                        returning: vi.fn().mockResolvedValue([{ id: 'invite-1', ...values }]),
                    };
                }),
            });

            await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com' })
            }), { params: Promise.resolve({ id: 'community-1' }) });

            expect(insertedValues.role).toBe('scorer');
        });
    });
});
