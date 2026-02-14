import { NextResponse } from 'next/server';
import { db } from '@/db';
import { seasons, games, teams, teamSeasons } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull } from 'drizzle-orm';

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

    // Get all teams in this season
    const teamsInSeason = await db.query.teamSeasons.findMany({
      where: eq(teamSeasons.seasonId, seasonId),
      with: {
        team: true,
      },
    });

    // Get all finished games in this season
    const seasonGames = await db.query.games.findMany({
      where: and(
        eq(games.seasonId, seasonId),
        eq(games.status, 'final'),
        isNull(games.deletedAt)
      ),
    });

    // Initialize standings map
    const standings: Record<string, any> = {};
    for (const ts of teamsInSeason) {
      standings[ts.teamId] = {
        teamId: ts.teamId,
        teamName: ts.team.name,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      };
    }

    // Calculate standings from games
    for (const game of seasonGames) {
      if (!game.homeTeamId || !game.guestTeamId) continue;

      // Ensure teams are in standings map (they should be, but just in case)
      if (!standings[game.homeTeamId]) {
        standings[game.homeTeamId] = { teamId: game.homeTeamId, teamName: game.homeTeamName, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
      }
      if (!standings[game.guestTeamId]) {
        standings[game.guestTeamId] = { teamId: game.guestTeamId, teamName: game.guestTeamName, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
      }

      const home = standings[game.homeTeamId];
      const guest = standings[game.guestTeamId];

      home.played += 1;
      guest.played += 1;
      home.pointsFor += game.homeScore;
      home.pointsAgainst += game.guestScore;
      guest.pointsFor += game.guestScore;
      guest.pointsAgainst += game.homeScore;
      home.pointDiff = home.pointsFor - home.pointsAgainst;
      guest.pointDiff = guest.pointsFor - guest.pointsAgainst;

      if (game.homeScore > game.guestScore) {
        home.wins += 1;
        guest.losses += 1;
      } else if (game.homeScore < game.guestScore) {
        guest.wins += 1;
        home.losses += 1;
      }
    }

    // Convert to array and sort
    const sortedStandings = Object.values(standings).sort((a, b) => {
      // Sort by wins (desc)
      if (b.wins !== a.wins) return b.wins - a.wins;
      // Then by point diff (desc)
      return b.pointDiff - a.pointDiff;
    });

    return NextResponse.json(sortedStandings);
  } catch (error) {
    console.error('Error fetching season standings:', error);
    return NextResponse.json({ error: 'Failed to fetch season standings' }, { status: 500 });
  }
}
