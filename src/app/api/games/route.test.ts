import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { db } from '@/db';
import { games } from '@/db/schema';
import { auth } from '@/lib/auth-server';

vi.mock('@/db', () => ({
    db: {
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(),
            })),
        })),
        query: {
            teamMemberships: {
                findMany: vi.fn(),
            },
            games: {
                findFirst: vi.fn(),
            },
        },
    },
}));

vi.mock('@/lib/auth-server', () => ({
    auth: vi.fn(),
}));

describe('Games API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a game and return results', async () => {
        (auth as unknown as { mockReturnValue: (value: { userId: string | null }) => void }).mockReturnValue({ userId: 'user_123' });
        const mockGame = { id: 'g1', homeTeamName: 'Home', guestTeamName: 'Guest' };

        (db.insert as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockGame]),
            }),
        });
        (db.query.games.findFirst as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockGame);

        const request = new Request('http://localhost/api/games', {
            method: 'POST',
            body: JSON.stringify({ homeTeamName: 'Home', guestTeamName: 'Guest' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockGame);
        expect(db.insert).toHaveBeenCalledWith(games);
    });
});
