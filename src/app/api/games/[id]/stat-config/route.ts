import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateStatConfig, updateStatConfig } from '@/services/stats';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

    const config = await getOrCreateStatConfig(
      gameId,
      game.seasonId || undefined,
      game.communityId || undefined,
      userId
    );

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching stat config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stat configuration' },
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

    if (game.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Only game owner can modify stat configuration' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const result = await updateStatConfig(gameId, body, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(result.config);
  } catch (error) {
    console.error('Error updating stat config:', error);
    return NextResponse.json(
      { error: 'Failed to update stat configuration' },
      { status: 500 }
    );
  }
}
