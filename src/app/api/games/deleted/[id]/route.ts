import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNotNull } from 'drizzle-orm';

// POST /api/games/deleted/[id]/restore - Restore a deleted game (World Admin only)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;

    try {
        // Check if user is world admin
        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!currentUser?.isWorldAdmin) {
            return NextResponse.json({ error: 'Forbidden - World admin only' }, { status: 403 });
        }

        // Check if game exists and is deleted
        const game = await db.query.games.findFirst({
            where: and(
                eq(games.id, gameId),
                isNotNull(games.deletedAt)
            ),
        });

        if (!game) {
            return NextResponse.json({ error: 'Deleted game not found' }, { status: 404 });
        }

        // Restore the game by clearing deletedAt
        await db.update(games)
            .set({ deletedAt: null })
            .where(eq(games.id, gameId));

        return NextResponse.json({ success: true, message: 'Game restored' });
    } catch (error) {
        console.error('Error restoring game:', error);
        return NextResponse.json({ error: 'Failed to restore game' }, { status: 500 });
    }
}
