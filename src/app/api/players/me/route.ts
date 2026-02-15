import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, teamMemberships, playerHistory } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find the player profile associated with this user
    const player = await db.query.athletes.findFirst({
      where: eq(athletes.userId, userId),
      with: {
        community: {
          columns: { id: true, name: true, slug: true },
        },
        memberships: {
          where: eq(teamMemberships.isActive, true),
          with: {
            team: {
              columns: { id: true, name: true, communityId: true },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({
        hasProfile: false,
        message: 'No player profile linked to this user account. Ask your community admin to invite you.',
      });
    }

    // Get player history
    const history = await db.query.playerHistory.findMany({
      where: eq(playerHistory.athleteId, player.id),
      orderBy: [desc(playerHistory.createdAt)],
      with: {
        team: {
          columns: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      hasProfile: true,
      player: {
        ...player,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    return NextResponse.json({ error: 'Failed to fetch player profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { firstName, surname, email, birthDate } = body;

    // Find the player profile associated with this user
    const player = await db.query.athletes.findFirst({
      where: eq(athletes.userId, userId),
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Handle firstName/surname updates and recompute name
    if (firstName !== undefined) updates.firstName = firstName;
    if (surname !== undefined) updates.surname = surname;

    // Recompute the `name` field when firstName or surname changes
    const newFirstName = firstName !== undefined ? firstName : player.firstName;
    const newSurname = surname !== undefined ? surname : player.surname;
    if (firstName !== undefined || surname !== undefined) {
      updates.name = `${newFirstName || ''} ${newSurname || ''}`.trim();
    }

    if (email !== undefined) updates.email = email;
    if (birthDate !== undefined) updates.birthDate = birthDate;

    const [updatedPlayer] = await db.update(athletes)
      .set(updates)
      .where(eq(athletes.id, player.id))
      .returning();

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player profile:', error);
    return NextResponse.json({ error: 'Failed to update player profile' }, { status: 500 });
  }
}
