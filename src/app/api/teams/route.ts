import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, communities, communityMembers, teamSeasons, seasons } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, or, ilike, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const communityId = searchParams.get('communityId');
    const seasonId = searchParams.get('seasonId');
    const myTeams = searchParams.get('myTeams') === 'true';

    // Get communities where user is a member
    const userCommunities = await db.query.communityMembers.findMany({
      where: eq(communityMembers.userId, userId),
    });

    const communityIds = userCommunities.map(m => m.communityId);

    // Base query conditions
    const conditions = [];

    if (myTeams) {
      conditions.push(eq(teams.ownerId, userId));
    } else {
      // Show teams owned by user or in communities where user is a member
      conditions.push(
        or(
          eq(teams.ownerId, userId),
          communityId
            ? eq(teams.communityId, communityId)
            : undefined
        )!
      );
    }

    // Search by name
    if (query && query.length >= 2) {
      const searchTerm = `%${query}%`;
      conditions.push(ilike(teams.name, searchTerm));
    }

    // Filter by community
    if (communityId && !myTeams) {
      conditions.push(eq(teams.communityId, communityId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let teamList = await db.query.teams.findMany({
      where: whereClause,
      orderBy: [desc(teams.createdAt)],
      columns: {
        id: true,
        ownerId: true,
        name: true,
        shortCode: true,
        color: true,
        createdAt: true,
        communityId: true,
      },
      with: {
        community: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
        teamSeasons: {
          with: {
            season: {
              columns: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Filter by season if specified
    if (seasonId) {
      teamList = teamList.filter(team =>
        team.teamSeasons.some(ts => ts.seasonId === seasonId)
      );
    }

    return NextResponse.json(teamList);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, shortCode, color, communityId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const [newTeam] = await db.insert(teams).values({
      ownerId: userId,
      communityId: communityId || null,
      name,
      shortCode,
      color,
    }).returning();

    return NextResponse.json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
