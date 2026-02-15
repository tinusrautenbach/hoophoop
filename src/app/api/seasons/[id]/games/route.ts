import { NextResponse } from 'next/server';
import { db } from '@/db';
import { seasons, games } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seasonId } = await params;

  try {
    const season = await db.query.seasons.findFirst({
      where: eq(seasons.id, seasonId),
      with: {
        community: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    // Check if user is a member of the community
    const isMember = season.community.members.some(m => m.userId === userId);
    const isOwner = season.community.ownerId === userId;

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const seasonGames = await db.query.games.findMany({
      where: and(
        eq(games.seasonId, seasonId),
        isNull(games.deletedAt)
      ),
      orderBy: [desc(games.createdAt)],
      with: {
        homeTeam: {
            columns: { id: true, name: true }
        },
        guestTeam: {
            columns: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(seasonGames);
  } catch (error) {
    console.error('Error fetching season games:', error);
    return NextResponse.json({ error: 'Failed to fetch season games' }, { status: 500 });
  }
}
