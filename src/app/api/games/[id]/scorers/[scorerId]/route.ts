import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameScorers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// DELETE - Remove a scorer from a game
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; scorerId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId, scorerId } = await params;

    try {
        // Verify game exists
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Get the scorer to be removed
        const scorerToRemove = await db.query.gameScorers.findFirst({
            where: and(
                eq(gameScorers.id, scorerId),
                eq(gameScorers.gameId, gameId)
            ),
        });

        if (!scorerToRemove) {
            return NextResponse.json({ error: 'Scorer not found' }, { status: 404 });
        }

        // Only owner can remove scorers (or users can remove themselves)
        const isOwner = game.ownerId === userId;
        const isSelf = scorerToRemove.userId === userId;

        if (!isOwner && !isSelf) {
            return NextResponse.json({ error: 'Not authorized to remove this scorer' }, { status: 403 });
        }

        // Cannot remove the owner
        if (scorerToRemove.userId === game.ownerId) {
            return NextResponse.json({ error: 'Cannot remove the game owner' }, { status: 403 });
        }

        // Remove the scorer
        await db.delete(gameScorers)
            .where(and(
                eq(gameScorers.id, scorerId),
                eq(gameScorers.gameId, gameId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing scorer:', error);
        return NextResponse.json({ error: 'Failed to remove scorer' }, { status: 500 });
    }
}
