import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teamSeasons, seasons, teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seasonId } = await params;

  try {
    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Get the season and verify user has access
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

    // Check if user is an admin or owner
    const isAdmin = season.community.members.some(
      m => m.userId === userId && m.role === 'admin'
    );
    const isOwner = season.community.ownerId === userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team is already in the season
    const existing = await db.query.teamSeasons.findFirst({
      where: and(
        eq(teamSeasons.seasonId, seasonId),
        eq(teamSeasons.teamId, teamId)
      ),
    });

    if (existing) {
      return NextResponse.json({ error: 'Team already in season' }, { status: 409 });
    }

    const [teamSeason] = await db.insert(teamSeasons).values({
      seasonId,
      teamId,
      communityId: season.communityId,
    }).returning();

    return NextResponse.json(teamSeason);
  } catch (error) {
    console.error('Error adding team to season:', error);
    return NextResponse.json({ error: 'Failed to add team to season' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seasonId } = await params;
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
  }

  try {
    // Get the season and verify user has access
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

    // Check if user is an admin or owner
    const isAdmin = season.community.members.some(
      m => m.userId === userId && m.role === 'admin'
    );
    const isOwner = season.community.ownerId === userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.delete(teamSeasons)
      .where(
        and(
          eq(teamSeasons.seasonId, seasonId),
          eq(teamSeasons.teamId, teamId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team from season:', error);
    return NextResponse.json({ error: 'Failed to remove team from season' }, { status: 500 });
  }
}
