import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, teams } from '@/db/schema';
import { eq, or, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth check (optional, but good practice if stats are private)
  const { userId } = await auth();
  if (!userId) {
     // For now, let's allow public access or consistent with other endpoints
     // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: teamId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    // 2. Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 3. Build query conditions
    const conditions = [
        or(eq(games.homeTeamId, teamId), eq(games.guestTeamId, teamId)),
        eq(games.status, 'final'),
        isNull(games.deletedAt),
    ];

    if (seasonId) {
        conditions.push(eq(games.seasonId, seasonId));
    }

    const teamGames = await db
        .select()
        .from(games)
        .where(and(...conditions));

    // 4. Calculate Stats
    const stats = {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        avgPointsFor: 0,
        avgPointsAgainst: 0,
        homeGames: 0,
        awayGames: 0,
    };

    for (const game of teamGames) {
        stats.gamesPlayed++;

        const isHome = game.homeTeamId === teamId;
        const teamScore = isHome ? game.homeScore : game.guestScore;
        const oppScore = isHome ? game.guestScore : game.homeScore;

        stats.pointsFor += teamScore;
        stats.pointsAgainst += oppScore;

        if (isHome) stats.homeGames++;
        else stats.awayGames++;

        if (teamScore > oppScore) {
            stats.wins++;
        } else if (teamScore < oppScore) {
            stats.losses++;
        } else {
            // Draw logic (if needed)
            // Assuming basketball can have draws if configured, or just OT.
            // But if scores are equal, it's a draw.
            if (teamScore === oppScore) stats.draws++;
        }
    }

    stats.pointsDiff = stats.pointsFor - stats.pointsAgainst;

    if (stats.gamesPlayed > 0) {
        stats.avgPointsFor = Number((stats.pointsFor / stats.gamesPlayed).toFixed(1));
        stats.avgPointsAgainst = Number((stats.pointsAgainst / stats.gamesPlayed).toFixed(1));
    }

    return NextResponse.json({
        teamId,
        seasonId: seasonId || 'all-time',
        stats
    });

  } catch (error) {
    console.error('Error fetching team stats:', error);
    return NextResponse.json({ error: 'Failed to fetch team statistics' }, { status: 500 });
  }
}
