import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameRosters } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: gameId } = await params;

    try {
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
            with: {
                rosters: true,
                events: {
                    orderBy: (events, { desc }) => [desc(events.createdAt)]
                }
            }
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        return NextResponse.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;
    const body = await request.json();

    try {
        // Verify ownership
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.ownerId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Handle game updates
        const { rosters: updatedRosters, ...gameUpdates } = body;

        await db.transaction(async (tx) => {
            if (Object.keys(gameUpdates).length > 0) {
                await tx.update(games)
                    .set({ ...gameUpdates, updatedAt: new Date() })
                    .where(eq(games.id, gameId));
            }

            if (updatedRosters && Array.isArray(updatedRosters)) {
                for (const r of updatedRosters) {
                    await tx.update(gameRosters)
                        .set({
                            points: r.points,
                            fouls: r.fouls,
                            isActive: r.isActive
                        })
                        .where(eq(gameRosters.id, r.id));
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating game:', error);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
    }
}
