import { NextResponse } from 'next/server';
import { db } from '@/db';
import { seasons, communities } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

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
          columns: { id: true, name: true },
        },
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    return NextResponse.json(season);
  } catch (error) {
    console.error('Error fetching season:', error);
    return NextResponse.json({ error: 'Failed to fetch season' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { name, startDate, endDate, status, description } = body;

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

    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (status !== undefined) updates.status = status;

    // Auto-update status based on dates if dates changed
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(season.startDate);
      const end = endDate ? new Date(endDate) : new Date(season.endDate);
      const now = new Date();

      if (now >= start && now <= end) {
        updates.status = 'active';
      } else if (now > end) {
        updates.status = 'completed';
      } else {
        updates.status = 'upcoming';
      }
    }

    updates.updatedAt = new Date();

    const [updatedSeason] = await db.update(seasons)
      .set(updates)
      .where(eq(seasons.id, seasonId))
      .returning();

    return NextResponse.json(updatedSeason);
  } catch (error) {
    console.error('Error updating season:', error);
    return NextResponse.json({ error: 'Failed to update season' }, { status: 500 });
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

    await db.delete(seasons).where(eq(seasons.id, seasonId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 });
  }
}
