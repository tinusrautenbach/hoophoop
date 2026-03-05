import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStatConfigInheritance } from '@/services/stats';
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

    const inheritance = await getStatConfigInheritance(
      gameId,
      game.seasonId || undefined,
      game.communityId || undefined
    );

    return NextResponse.json(inheritance);
  } catch (error) {
    console.error('Error fetching stat config inheritance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stat configuration inheritance' },
      { status: 500 }
    );
  }
}
