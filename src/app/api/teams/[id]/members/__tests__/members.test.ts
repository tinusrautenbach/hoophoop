import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
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
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
            }),
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue({
                    returning: vi.fn().mockResolvedValue([]),
                }),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Team Members API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return team members', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockMembers = [{ id: 'm1', athlete: { name: 'Jordan' } }];
            (db.query.teamMemberships.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockMembers);

            const request = new Request('http://localhost/api/teams/t1/members');
            const response = await GET(request, { params: Promise.resolve({ id: 't1' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockMembers);
        });
    });

    describe('POST', () => {
        it('should add a new member to the team', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });

            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => { mockResolvedValueOnce: (value: unknown) => void } }).mockResolvedValue(null).mockResolvedValueOnce({
                id: 'm1',
                athleteId: 'a1',
                teamId: 't1',
                number: '23',
                athlete: { id: 'a1', name: 'LeBron' }
            });

            const mockAthlete = { id: 'a1', name: 'LeBron' };
            const mockMembership = { 
                id: 'm1', 
                athleteId: 'a1', 
                teamId: 't1', 
                number: '23' 
            };

            let insertCallCount = 0;
            (db.insert as unknown as { mockImplementation: (callback: unknown) => void }).mockImplementation(() => {
                insertCallCount++;
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue(
                            insertCallCount === 1 ? [mockAthlete] : [mockMembership]
                        ),
                    }),
                };
            });

            const request = new Request('http://localhost/api/teams/t1/members', {
                method: 'POST',
                body: JSON.stringify({ name: 'LeBron', number: '23' }),
            });

            const response = await POST(request, { params: Promise.resolve({ id: 't1' }) });

            expect(response.status).toBe(200);
            expect(db.insert).toHaveBeenCalledTimes(3);
        });

        it('should return 409 if player already on team', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });

            (db.query.athletes.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({ 
                id: 'a1', 
                name: 'Existing Player' 
            });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({ 
                id: 'existing-membership',
                athleteId: 'a1' 
            });

            const request = new Request('http://localhost/api/teams/t1/members', {
                method: 'POST',
                body: JSON.stringify({ athleteId: 'a1' }),
            });

            const response = await POST(request, { params: Promise.resolve({ id: 't1' }) });

            expect(response.status).toBe(409);
        });
    });
});
