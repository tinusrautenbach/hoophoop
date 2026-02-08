import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { teams, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            teams: {
                findMany: vi.fn(),
            },
            communityMembers: {
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

describe('Community Teams API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 403 if not a community member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            expect(response.status).toBe(403);
        });

        it('should return community teams for members', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_123',
                role: 'scorer'
            });
            (db.query.teams.findMany as any).mockResolvedValue([
                { id: 'team-1', name: 'Varsity', communityId: 'community-1' },
                { id: 'team-2', name: 'Junior Varsity', communityId: 'community-1' }
            ]);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.length).toBe(2);
            expect(data[0].name).toBe('Varsity');
        });

        it('should return empty array for community with no teams', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_123',
                role: 'viewer'
            });
            (db.query.teams.findMany as any).mockResolvedValue([]);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'community-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Team' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 403 if not a community member', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Team' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(403);
        });

        it('should return 403 if member cannot manage games', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_123',
                role: 'scorer',
                canManageGames: false
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Team' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(403);
        });

        it('should return 400 if name is missing', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_123',
                role: 'admin',
                canManageGames: true
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: '' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            expect(response.status).toBe(400);
        });

        it('should allow admin to create team', async () => {
            (auth as any).mockReturnValue({ userId: 'user_admin' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_admin',
                role: 'admin',
                canManageGames: true
            });

            const mockTeam = {
                id: 'team-1',
                name: 'New Team',
                communityId: 'community-1',
                ownerId: 'user_admin'
            };

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockTeam]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Team', shortCode: 'NT' })
            }), { params: Promise.resolve({ id: 'community-1' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('New Team');
            expect(data.communityId).toBe('community-1');
        });

        it('should create team with all provided fields', async () => {
            (auth as any).mockReturnValue({ userId: 'user_member' });
            (db.query.communityMembers.findFirst as any).mockResolvedValue({
                communityId: 'community-1',
                userId: 'user_member',
                role: 'scorer',
                canManageGames: true
            });

            let insertedValues: any = {};
            (db.insert as any).mockReturnValue({
                values: vi.fn().mockImplementation((values) => {
                    insertedValues = values;
                    return {
                        returning: vi.fn().mockResolvedValue([{ id: 'team-1', ...values }]),
                    };
                }),
            });

            await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ 
                    name: 'Varsity Team',
                    shortCode: 'VAR',
                    color: '#FF5733'
                })
            }), { params: Promise.resolve({ id: 'community-1' }) });

            expect(insertedValues.name).toBe('Varsity Team');
            expect(insertedValues.shortCode).toBe('VAR');
            expect(insertedValues.color).toBe('#FF5733');
            expect(insertedValues.communityId).toBe('community-1');
        });
    });
});
