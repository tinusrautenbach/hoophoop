import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            communities: {
                findMany: vi.fn(),
            },
            communityMembers: {
                findMany: vi.fn(),
            },
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(),
            })),
        })),
        transaction: vi.fn((callback) => callback({
            insert: vi.fn(() => ({
                values: vi.fn().mockResolvedValue([{ id: 'community-1' }]),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/activity-logger', () => ({
    logActivity: vi.fn(),
}));

describe('Communities API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await GET();
            expect(response.status).toBe(401);
        });

        it('should return user communities when authenticated', async () => {
            const mockUserId = 'user_123';
            const mockCommunities = [
                { id: 'community-1', name: 'Test Community', ownerId: mockUserId }
            ];
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.communityMembers.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { communityId: 'community-1' }
            ]);
            (db.query.communities.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockCommunities);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockCommunities);
            expect(db.query.communityMembers.findMany).toHaveBeenCalled();
            expect(db.query.communities.findMany).toHaveBeenCalled();
        });

        it('should return empty array when user has no communities', async () => {
            const mockUserId = 'user_456';
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.communityMembers.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([]);
            (db.query.communities.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([]);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it('should include communities where user is owner', async () => {
            const mockUserId = 'user_owner';
            const mockCommunities = [
                { id: 'community-owned', name: 'Owned Community', ownerId: mockUserId }
            ];
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });
            (db.query.communityMembers.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([]);
            (db.query.communities.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockCommunities);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data[0].name).toBe('Owned Community');
        });
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const request = new Request('http://localhost/api/communities', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test Community' }),
            });
            const response = await POST(request);
            expect(response.status).toBe(401);
        });

        it('should return 400 if name is missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const request = new Request('http://localhost/api/communities', {
                method: 'POST',
                body: JSON.stringify({ name: '' }),
            });
            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it('should create a new community with default type', async () => {
            const mockUserId = 'user_123';
            const mockCommunity = { 
                id: 'community-1', 
                name: 'New Community', 
                type: 'other',
                ownerId: mockUserId 
            };
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });

            const mockTx = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockCommunity]),
                    }),
                }),
            };
            (db.transaction as unknown as { mockImplementation: (callback: unknown) => void }).mockImplementation(async (callback: unknown) => {
                await (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
                return [mockCommunity];
            });

            const request = new Request('http://localhost/api/communities', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Community' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe('New Community');
            expect(data.type).toBe('other');
        });

        it('should create a community with specified type', async () => {
            const mockUserId = 'user_123';
            const mockCommunity = { 
                id: 'community-2', 
                name: 'School Team', 
                type: 'school',
                ownerId: mockUserId 
            };
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });

            const mockTx = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockCommunity]),
                    }),
                }),
            };
            (db.transaction as unknown as { mockImplementation: (callback: unknown) => void }).mockImplementation(async (callback: unknown) => {
                await (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
                return [mockCommunity];
            });

            const request = new Request('http://localhost/api/communities', {
                method: 'POST',
                body: JSON.stringify({ name: 'School Team', type: 'school' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.type).toBe('school');
        });

        it('should add owner as admin member when creating community', async () => {
            const mockUserId = 'user_admin';
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: mockUserId });

            const insertedValues: Record<string, unknown>[] = [];
            const mockTx = {
                insert: vi.fn().mockImplementation((table: unknown) => ({
                    values: vi.fn().mockImplementation((values) => {
                        insertedValues.push(values);
                        return {
                            returning: vi.fn().mockResolvedValue([{ id: 'community-1' }]),
                        };
                    }),
                })),
            };
            (db.transaction as unknown as { mockImplementation: (callback: unknown) => void }).mockImplementation(async (callback: unknown) => {
                await (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
            });

            const request = new Request('http://localhost/api/communities', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test Community' }),
            });

            await POST(request);

            expect(insertedValues.length).toBe(2);
            expect(insertedValues[1].role).toBe('admin');
            expect(insertedValues[1].canManageGames).toBe(true);
        });
    });
});
