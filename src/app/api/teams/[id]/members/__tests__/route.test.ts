import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { athletes } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            athletes: {
                findFirst: vi.fn(),
            },
            teamMemberships: {
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

describe('Teams [id] Members API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return team members', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockMembers = [
                { id: 'member-1', number: '23', athlete: { id: 'player-1', name: 'Jordan' } },
                { id: 'member-2', number: '33', athlete: { id: 'player-2', name: 'Pippen' } }
            ];
            (db.query.teamMemberships.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockMembers);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.length).toBe(2);
        });
    });

    describe('POST - Add Member', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Player', number: '23' })
            }), { params: Promise.resolve({ id: 'team-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 400 if no name or athleteId', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({})
            }), { params: Promise.resolve({ id: 'team-1' }) });
            expect(response.status).toBe(400);
        });

        it('should return 404 if athlete not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ athleteId: 'non-existent' })
            }), { params: Promise.resolve({ id: 'team-1' }) });
            expect(response.status).toBe(404);
        });

        it('should return 409 if player already on team', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'player-1',
                name: 'Existing Player'
            });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'existing-member',
                teamId: 'team-1',
                athleteId: 'player-1'
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ athleteId: 'player-1' })
            }), { params: Promise.resolve({ id: 'team-1' }) });
            expect(response.status).toBe(409);
        });

        it('should create new player and add to team', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const mockAthlete = { id: 'player-new', name: 'New Player' };
            const mockMembership = { 
                id: 'member-1', 
                number: '23', 
                athleteId: 'player-new',
                athlete: mockAthlete 
            };

            let insertValues: Record<string, unknown> = {};
            (db.insert as unknown as { mockImplementation: (callback: unknown) => { mockReturnValue: (value: unknown) => void } }).mockImplementation((table: unknown) => ({
                values: vi.fn((values: unknown) => {
                    insertValues = { table, values };
                    return {
                        returning: vi.fn().mockResolvedValue([table === athletes ? mockAthlete : mockMembership]),
                    };
                }),
            }));

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Player', number: '23' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(200);
        });

        it('should add existing player to team', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
                id: 'player-existing',
                name: 'Existing Player'
            });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const mockMembership = { 
                id: 'member-1', 
                number: '99',
                athlete: { id: 'player-existing', name: 'Existing Player' }
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockMembership]),
                }),
            });

            const response = await POST(new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ athleteId: 'player-existing', number: '99' })
            }), { params: Promise.resolve({ id: 'team-1' }) });

            expect(response.status).toBe(200);
        });
    });
});
