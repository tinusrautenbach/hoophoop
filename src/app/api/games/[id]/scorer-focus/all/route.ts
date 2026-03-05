import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAllScorerFocuses } from '@/services/stats';
import { db } from '@/db';
import { games, gameScorers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;

    const game = await db.query.games.findFirst({
      where: eq(games.id, gameId),
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if user is owner or scorer for this game
    const isOwner = game.ownerId === userId;
    const isScorer = await db.query.gameScorers.findFirst({
      where: and(
        eq(gameScorers.gameId, gameId),
        eq(gameScorers.userId, userId)
      ),
    });

    if (!isOwner && !isScorer) {
      return NextResponse.json(
        { error: 'Only game owner and scorers can view all focuses' },
        { status: 403 }
      );
    }

    const scorers = await getAllScorerFocuses(gameId);

    return NextResponse.json({ scorers });
  } catch (error) {
    console.error('Error fetching all scorer focuses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scorer focuses' },
      { status: 500 }
    );
  }
}
