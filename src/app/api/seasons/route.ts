import { NextResponse } from 'next/server';
import { db } from '@/db';
import { seasons, communities } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const status = searchParams.get('status');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // Check if user is a member of the community
    const community = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
      with: {
        members: true,
      },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members.some(m => m.userId === userId);
    const isOwner = community.ownerId === userId;

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const conditions = [eq(seasons.communityId, communityId)];

    if (status) {
      conditions.push(eq(seasons.status, status as 'upcoming' | 'active' | 'completed' | 'archived'));
    }

    const seasonsList = await db.query.seasons.findMany({
      where: and(...conditions),
      orderBy: [desc(seasons.startDate)],
      with: {
        teamSeasons: {
          with: {
            team: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(seasonsList);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, startDate, endDate, communityId, description } = body;

    if (!name || !startDate || !endDate || !communityId) {
      return NextResponse.json(
        { error: 'Name, start date, end date, and community ID are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Check if user is a member of the community
    const community = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
      with: {
        members: true,
      },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members.some(m => m.userId === userId);
    const isOwner = community.ownerId === userId;

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine season status based on dates
    const now = new Date();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';

    if (now >= start && now <= end) {
      status = 'active';
    } else if (now > end) {
      status = 'completed';
    }

    const [season] = await db.insert(seasons).values({
      communityId,
      name,
      startDate,
      endDate,
      status,
      description: description || null,
    }).returning();

    return NextResponse.json(season);
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
  }
}
