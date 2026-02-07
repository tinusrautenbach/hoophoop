import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { athletes, teamMemberships } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';

vi.mock('@/db', () => ({
    db: {
        query: {
            teamMemberships: {
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

vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
}));

describe('Team Members API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return team members', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const mockMembers = [{ id: 'm1', athlete: { name: 'Jordan' } }];
            (db.query.teamMemberships.findMany as any).mockReturnValue(mockMembers);

            const request = new Request('http://localhost/api/teams/t1/members');
            const response = await GET(request, { params: { id: 't1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockMembers);
        });
    });

    describe('POST', () => {
        it('should add a new member to the team', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });

            const mockAthlete = { id: 'a1', name: 'LeBron' };
            const mockMembership = { id: 'm1', athleteId: 'a1', teamId: 't1', number: '23' };

            const returningMock = vi.fn()
                .mockResolvedValueOnce([mockAthlete]) // First call for insert athletes
                .mockResolvedValueOnce([mockMembership]); // Second call for insert memberships

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: returningMock,
                }),
            });

            const request = new Request('http://localhost/api/teams/t1/members', {
                method: 'POST',
                body: JSON.stringify({ name: 'LeBron', number: '23' }),
            });

            const response = await POST(request, { params: { id: 't1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.athlete.name).toBe('LeBron');
            expect(db.insert).toHaveBeenCalledTimes(2);
        });
    });
});
