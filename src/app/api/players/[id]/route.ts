import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, playerHistory, teams, teamMemberships, communities } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, desc } from 'drizzle-orm';

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
        const player = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const history = await db.query.playerHistory.findMany({
            where: eq(playerHistory.athleteId, playerId),
            orderBy: [desc(playerHistory.createdAt)],
            with: {
                team: true,
            },
        });

        const memberships = await db.query.teamMemberships.findMany({
            where: eq(teamMemberships.athleteId, playerId),
            orderBy: [desc(teamMemberships.startDate)],
            with: {
                team: true,
            },
        });

        return NextResponse.json({
            ...player,
            history,
            memberships,
        });
    } catch (error) {
        console.error('Error fetching player:', error);
        return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
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

    const { id: playerId } = await params;

    try {
        const body = await request.json();
        const { name, email, birthDate, status } = body;

        const existingPlayer = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!existingPlayer) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (birthDate !== undefined) updates.birthDate = birthDate;
        if (status !== undefined) updates.status = status;

        const [updatedPlayer] = await db.update(athletes)
            .set(updates)
            .where(eq(athletes.id, playerId))
            .returning();

        return NextResponse.json(updatedPlayer);
    } catch (error) {
        console.error('Error updating player:', error);
        return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
    }
}
