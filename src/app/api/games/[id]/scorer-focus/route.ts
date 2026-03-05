import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateScorerFocus, updateScorerFocus } from '@/services/stats';
import { db } from '@/db';
import { games, gameScorers, gameStatConfigs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { PrimaryStatType } from '@/types/stats';

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

    // Check if user is a scorer for this game
    const scorer = await db.query.gameScorers.findFirst({
      where: and(
        eq(gameScorers.gameId, gameId),
        eq(gameScorers.userId, userId)
      ),
    });

    if (!scorer) {
      return NextResponse.json(
        { error: 'You must be an active scorer for this game' },
        { status: 403 }
      );
    }

    // Get enabled stats for this game
    const statConfig = await db.query.gameStatConfigs.findFirst({
      where: eq(gameStatConfigs.gameId, gameId),
    });

    const enabledStats = statConfig?.enabledStats as PrimaryStatType[] || [
      PrimaryStatType.POINTS_2PT,
      PrimaryStatType.POINTS_3PT,
      PrimaryStatType.ASSIST,
    ];

    const focus = await getOrCreateScorerFocus(gameId, userId, enabledStats);

    return NextResponse.json({
      ...focus,
      source: scorer.statFocus ? 'per_game' : 'game_default',
    });
  } catch (error) {
    console.error('Error fetching scorer focus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scorer focus' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Check if user is a scorer for this game
    const scorer = await db.query.gameScorers.findFirst({
      where: and(
        eq(gameScorers.gameId, gameId),
        eq(gameScorers.userId, userId)
      ),
    });

    if (!scorer) {
      return NextResponse.json(
        { error: 'You must be an active scorer for this game' },
        { status: 403 }
      );
    }

    // Get enabled stats for this game
    const statConfig = await db.query.gameStatConfigs.findFirst({
      where: eq(gameStatConfigs.gameId, gameId),
    });

    const enabledStats = statConfig?.enabledStats as PrimaryStatType[] || [
      PrimaryStatType.POINTS_2PT,
      PrimaryStatType.POINTS_3PT,
      PrimaryStatType.ASSIST,
    ];

    const body = await request.json();

    const result = await updateScorerFocus(gameId, userId, body, enabledStats);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(result.focus);
  } catch (error) {
    console.error('Error updating scorer focus:', error);
    return NextResponse.json(
      { error: 'Failed to update scorer focus' },
      { status: 500 }
    );
  }
}
