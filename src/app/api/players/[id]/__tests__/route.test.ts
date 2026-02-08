import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import { db } from '@/db';
import { athletes, playerHistory, teamMemberships } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            athletes: {
                findFirst: vi.fn(),
            },
            playerHistory: {
                findMany: vi.fn(),
            },
            teamMemberships: {
                findMany: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'player-1' }]),
                }),
            })),
        })),
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Players [id] API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'player-1' }) 
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 if player not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as any).mockResolvedValue(null);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'non-existent' }) 
            });
            expect(response.status).toBe(404);
        });

        it('should return player with history and memberships', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'Test Player',
                email: null,
                status: 'active'
            };
            const mockHistory = [
                { id: 'history-1', action: 'added', team: { id: 'team-1', name: 'Team A' } }
            ];
            const mockMemberships = [
                { id: 'member-1', number: '23', isActive: true, team: { id: 'team-1', name: 'Team A' } }
            ];

            (db.query.athletes.findFirst as any).mockResolvedValue(mockPlayer);
            (db.query.playerHistory.findMany as any).mockResolvedValue(mockHistory);
            (db.query.teamMemberships.findMany as any).mockResolvedValue(mockMemberships);

            const response = await GET(new Request('http://localhost'), { 
                params: Promise.resolve({ id: 'player-1' }) 
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('Test Player');
            expect(data.history).toEqual(mockHistory);
            expect(data.memberships).toEqual(mockMemberships);
        });
    });

    describe('PATCH', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated' })
            }), { params: Promise.resolve({ id: 'player-1' }) });
            expect(response.status).toBe(401);
        });

        it('should return 404 if player not found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as any).mockResolvedValue(null);

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated' })
            }), { params: Promise.resolve({ id: 'non-existent' }) });
            expect(response.status).toBe(404);
        });

        it('should update player name', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as any).mockResolvedValue({
                id: 'player-1',
                name: 'Old Name'
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'New Name' })
            }), { params: Promise.resolve({ id: 'player-1' }) });

            expect(response.status).toBe(200);
            expect(db.update).toHaveBeenCalled();
        });

        it('should update multiple fields', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findFirst as any).mockResolvedValue({
                id: 'player-1',
                name: 'Test',
                email: null,
                status: 'active'
            });

            const response = await PATCH(new Request('http://localhost', {
                method: 'PATCH',
                body: JSON.stringify({
                    name: 'Updated Name',
                    email: 'test@example.com',
                    status: 'inactive'
                })
            }), { params: Promise.resolve({ id: 'player-1' }) });

            expect(response.status).toBe(200);
        });
    });
});
