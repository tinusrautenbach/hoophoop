import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameScorers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// GET - List all scorers for a game
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;

    try {
        // Verify game exists
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Check if user is owner or a scorer
        const isOwner = game.ownerId === userId;
        const isScorer = await db.query.gameScorers.findFirst({
            where: and(
                eq(gameScorers.gameId, gameId),
                eq(gameScorers.userId, userId)
            ),
        });

        if (!isOwner && !isScorer) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get all scorers for this game
        const scorers = await db.query.gameScorers.findMany({
            where: eq(gameScorers.gameId, gameId),
            orderBy: (scorers, { desc }) => [desc(scorers.joinedAt)],
        });

        return NextResponse.json(scorers);
    } catch (error) {
        console.error('Error fetching scorers:', error);
        return NextResponse.json({ error: 'Failed to fetch scorers' }, { status: 500 });
    }
}

// POST - Add a scorer to a game
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;
    const body = await request.json();
    const { userId: newScorerUserId, role = 'co_scorer' } = body;

    if (!newScorerUserId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        // Verify game exists
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Only owner can add scorers
        if (game.ownerId !== userId) {
            return NextResponse.json({ error: 'Only the game owner can add scorers' }, { status: 403 });
        }

        // Check if user is already a scorer
        const existingScorer = await db.query.gameScorers.findFirst({
            where: and(
                eq(gameScorers.gameId, gameId),
                eq(gameScorers.userId, newScorerUserId)
            ),
        });

        if (existingScorer) {
            return NextResponse.json({ error: 'User is already a scorer for this game' }, { status: 409 });
        }

        // Add the new scorer
        const [newScorer] = await db.insert(gameScorers)
            .values({
                gameId,
                userId: newScorerUserId,
                role,
            })
            .returning();

        return NextResponse.json(newScorer, { status: 201 });
    } catch (error) {
        console.error('Error adding scorer:', error);
        return NextResponse.json({ error: 'Failed to add scorer' }, { status: 500 });
    }
}
