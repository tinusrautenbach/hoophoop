import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, gameRosters, games, teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull, sql } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: playerId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const seasonId = searchParams.get('seasonId');

    // Verify player exists
    const player = await db.query.athletes.findFirst({
      where: eq(athletes.id, playerId),
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Build where conditions
    const whereConditions = [
      eq(gameRosters.athleteId, playerId),
      eq(games.status, 'final'),
      isNull(games.deletedAt),
    ];

    if (seasonId) {
      whereConditions.push(eq(games.seasonId, seasonId));
    }

    // Get all game rosters for this player
    const playerGameData = await db
      .select({
        roster: gameRosters,
        game: games,
      })
      .from(gameRosters)
      .innerJoin(games, eq(gameRosters.gameId, games.id))
      .where(and(...whereConditions))
      .execute();

    // Filter by teamId if specified
    let filteredData = playerGameData;
    if (teamId) {
      filteredData = playerGameData.filter(
        ({ game }) => game.homeTeamId === teamId || game.guestTeamId === teamId
      );
    }

    // Calculate lifetime statistics
    const lifetimeStats = {
      gamesPlayed: filteredData.length,
      totalPoints: filteredData.reduce((sum, { roster }) => sum + roster.points, 0),
      totalFouls: filteredData.reduce((sum, { roster }) => sum + roster.fouls, 0),
      avgPoints: 0,
      avgFouls: 0,
    };

    if (lifetimeStats.gamesPlayed > 0) {
      lifetimeStats.avgPoints = Number((lifetimeStats.totalPoints / lifetimeStats.gamesPlayed).toFixed(1));
      lifetimeStats.avgFouls = Number((lifetimeStats.totalFouls / lifetimeStats.gamesPlayed).toFixed(1));
    }

    // Get team-specific statistics
    const teamStats: Record<string, any> = {};

    for (const { roster, game } of filteredData) {
      // Determine which team the player was on
      const playerTeamId = roster.team === 'home' ? game.homeTeamId : game.guestTeamId;
      if (!playerTeamId) continue;

      if (!teamStats[playerTeamId]) {
        teamStats[playerTeamId] = {
          teamId: playerTeamId,
          gamesPlayed: 0,
          totalPoints: 0,
          totalFouls: 0,
          wins: 0,
          losses: 0,
        };
      }

      teamStats[playerTeamId].gamesPlayed += 1;
      teamStats[playerTeamId].totalPoints += roster.points;
      teamStats[playerTeamId].totalFouls += roster.fouls;

      // Calculate win/loss
      const playerScore = roster.team === 'home' ? game.homeScore : game.guestScore;
      const opponentScore = roster.team === 'home' ? game.guestScore : game.homeScore;

      if (playerScore > opponentScore) {
        teamStats[playerTeamId].wins += 1;
      } else if (playerScore < opponentScore) {
        teamStats[playerTeamId].losses += 1;
      }
    }

    // Fetch team names
    const teamStatsArray = await Promise.all(
      Object.values(teamStats).map(async (stats: any) => {
        const team = await db.query.teams.findFirst({
          where: eq(teams.id, stats.teamId),
          columns: { id: true, name: true },
        });

        return {
          ...stats,
          teamName: team?.name || 'Unknown Team',
          avgPoints: stats.gamesPlayed > 0
            ? Number((stats.totalPoints / stats.gamesPlayed).toFixed(1))
            : 0,
          avgFouls: stats.gamesPlayed > 0
            ? Number((stats.totalFouls / stats.gamesPlayed).toFixed(1))
            : 0,
        };
      })
    );

    // Get recent games (last 10)
    const recentGames = filteredData
      .sort((a, b) => {
        const dateA = a.game.scheduledDate ? new Date(a.game.scheduledDate).getTime() : 0;
        const dateB = b.game.scheduledDate ? new Date(b.game.scheduledDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10)
      .map(({ roster, game }) => ({
        gameId: game.id,
        gameName: game.name,
        scheduledDate: game.scheduledDate,
        homeTeamName: game.homeTeamName,
        guestTeamName: game.guestTeamName,
        homeScore: game.homeScore,
        guestScore: game.guestScore,
        points: roster.points,
        fouls: roster.fouls,
        team: roster.team,
      }));

    return NextResponse.json({
      playerId,
      lifetimeStats,
      teamStats: teamStatsArray,
      recentGames,
    });
  } catch (error) {
    console.error('Error fetching player statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch player statistics' }, { status: 500 });
  }
}
