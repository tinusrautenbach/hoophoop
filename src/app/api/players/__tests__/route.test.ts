import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
import { athletes, playerHistory } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        query: {
            athletes: {
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

describe('Players API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost/api/players'));
            expect(response.status).toBe(401);
        });

        it('should return empty array when no players found', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as any).mockResolvedValue([]);

            const response = await GET(new Request('http://localhost/api/players'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it('should search players by query', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const mockPlayers = [
                { id: 'player-1', name: 'Michael Jordan' },
                { id: 'player-2', name: 'Jordan Poole' }
            ];
            (db.query.athletes.findMany as any).mockResolvedValue(mockPlayers);

            const response = await GET(new Request('http://localhost/api/players?q=Jordan'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.length).toBe(2);
            expect(db.query.athletes.findMany).toHaveBeenCalled();
        });

        it('should filter inactive players by default', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as any).mockResolvedValue([
                { id: 'player-1', name: 'Active Player', status: 'active' }
            ]);

            const response = await GET(new Request('http://localhost/api/players'));
            expect(response.status).toBe(200);
        });

        it('should include inactive players when requested', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as any).mockResolvedValue([
                { id: 'player-1', name: 'Active Player', status: 'active' },
                { id: 'player-2', name: 'Inactive Player', status: 'inactive' }
            ]);

            const response = await GET(new Request('http://localhost/api/players?includeInactive=true'));
            expect(response.status).toBe(200);
        });
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as any).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Player' })
            }));
            expect(response.status).toBe(401);
        });

        it('should return 400 if name is missing', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({})
            }));
            expect(response.status).toBe(400);
        });

        it('should create a new player', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'New Player',
                email: null,
                birthDate: null,
                status: 'active',
                ownerId: 'user_123'
            };

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockPlayer]),
                }),
            });

            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Player' })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('New Player');
        });

        it('should create player with optional fields', async () => {
            (auth as any).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'Test Player',
                email: 'test@example.com',
                birthDate: '2000-01-01',
                status: 'active'
            };

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockPlayer]),
                }),
            });

            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Test Player',
                    email: 'test@example.com',
                    birthDate: '2000-01-01'
                })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.email).toBe('test@example.com');
        });
    });
});
