import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { db } from '@/db';
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
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await GET(new Request('http://localhost/api/players'));
            expect(response.status).toBe(401);
        });

        it('should return empty array when no players found', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([]);

            const response = await GET(new Request('http://localhost/api/players'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it('should search players by query on firstName/surname/name', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockPlayers = [
                { id: 'player-1', name: 'Michael Jordan', firstName: 'Michael', surname: 'Jordan' },
                { id: 'player-2', name: 'Jordan Poole', firstName: 'Jordan', surname: 'Poole' }
            ];
            (db.query.athletes.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockPlayers);

            const response = await GET(new Request('http://localhost/api/players?q=Jordan'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.length).toBe(2);
            expect(db.query.athletes.findMany).toHaveBeenCalled();
        });

        it('should scope search to community when communityId provided', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { id: 'player-1', name: 'Community Player', firstName: 'Community', surname: 'Player', communityId: 'comm-1' }
            ]);

            const response = await GET(new Request('http://localhost/api/players?q=Community&communityId=comm-1'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(db.query.athletes.findMany).toHaveBeenCalled();
        });

        it('should filter inactive players by default', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { id: 'player-1', name: 'Active Player', firstName: 'Active', surname: 'Player', status: 'active' }
            ]);

            const response = await GET(new Request('http://localhost/api/players'));
            expect(response.status).toBe(200);
        });

        it('should include inactive players when requested (but exclude merged)', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            (db.query.athletes.findMany as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
                { id: 'player-1', name: 'Active Player', status: 'active' },
                { id: 'player-2', name: 'Inactive Player', status: 'inactive' }
            ]);

            const response = await GET(new Request('http://localhost/api/players?includeInactive=true'));
            expect(response.status).toBe(200);
        });
    });

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: null });
            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({ firstName: 'New', surname: 'Player' })
            }));
            expect(response.status).toBe(401);
        });

        it('should return 400 if firstName and name are both missing', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({})
            }));
            expect(response.status).toBe(400);
        });

        it('should create a new player with firstName and surname', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'New Player',
                firstName: 'New',
                surname: 'Player',
                email: null,
                birthDate: null,
                status: 'active',
                ownerId: 'user_123'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockPlayer]),
                }),
            });

            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({ firstName: 'New', surname: 'Player' })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('New Player');
            expect(data.firstName).toBe('New');
            expect(data.surname).toBe('Player');
        });

        it('should create a player with legacy name field (backward compat)', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'Legacy Player',
                firstName: 'Legacy',
                surname: 'Player',
                status: 'active'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockPlayer]),
                }),
            });

            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({ name: 'Legacy Player' })
            }));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe('Legacy Player');
        });

        it('should create player with optional fields', async () => {
            (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
            const mockPlayer = {
                id: 'player-1',
                name: 'Test Player',
                firstName: 'Test',
                surname: 'Player',
                email: 'test@example.com',
                birthDate: '2000-01-01',
                status: 'active'
            };

            (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockPlayer]),
                }),
            });

            const response = await POST(new Request('http://localhost/api/players', {
                method: 'POST',
                body: JSON.stringify({
                    firstName: 'Test',
                    surname: 'Player',
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
