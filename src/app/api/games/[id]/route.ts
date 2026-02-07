import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameRosters } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gameId = params.id;

    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
            with: {
                rosters: true,
            }
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Optional: Check if user is owner
        if (game.ownerId !== userId) {
            // Allow spectators? For now let's assume this GET is for the scorer UI.
            // We might want separate endpoints later or different permissions.
        }

        return NextResponse.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
    }
}
