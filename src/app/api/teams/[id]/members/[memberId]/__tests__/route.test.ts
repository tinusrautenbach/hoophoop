import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '../route';
import { db } from '@/db';
import { auth } from '@/lib/auth-server';

const mockMembership = {
    id: 'member-1',
    teamId: 'team-1',
    athleteId: 'player-1',
    number: '23',
    athlete: { id: 'player-1', name: 'Jordan' }
};

vi.mock('@/db', () => ({
    db: {
        query: {
            teamMemberships: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockMembership]),
                }),
            }),
        })),
        insert: vi.fn(() => ({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'history-1' }]),
            }),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Teams [id] Members [memberId] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PATCH - Update Jersey Number', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ number: '24' })
            }), { params: Promise.resolve({ id: 'team-1', memberId: 'member-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 404 if membership not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ number: '24' })
            }), { params: Promise.resolve({ id: 'team-1', memberId: 'non-existent' }) });
            expect(response.status).toBe(404);
        });

        it('should update jersey number', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockMembership);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ number: '24' })
            }), { params: Promise.resolve({ id: 'team-1', memberId: 'member-1' }) });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
        });

        it('should log history when number changes', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockMembership);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ number: '24', notes: 'Number change' })
            }), { params: Promise.resolve({ id: 'team-1', memberId: 'member-1' }) });

            expect(response.status).toBe(200);
            expect(db.insert).toHaveBeenCalled();
        });
    });

    describe('DELETE - Remove from Team', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1', memberId: 'member-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if membership not found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null);

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1', memberId: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should soft delete and log history', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.teamMemberships.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockMembership);

            const response = await DELETE(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'team-1', memberId: 'member-1' }) 
            });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
            expect(db.insert).toHaveBeenCalled();
        });
    });
});
