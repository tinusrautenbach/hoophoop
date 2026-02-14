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
            with: {
                community: {
                    columns: { id: true, name: true },
                },
            },
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
        const { firstName, surname, name, email, birthDate, status } = body;

        const existingPlayer = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!existingPlayer) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const updates: Record<string, unknown> = {};

        // Handle firstName/surname updates and recompute name
        if (firstName !== undefined) updates.firstName = firstName;
        if (surname !== undefined) updates.surname = surname;

        // Recompute the `name` field when firstName or surname changes
        const newFirstName = firstName !== undefined ? firstName : existingPlayer.firstName;
        const newSurname = surname !== undefined ? surname : existingPlayer.surname;
        if (firstName !== undefined || surname !== undefined) {
            updates.name = `${newFirstName || ''} ${newSurname || ''}`.trim();
        }

        // Legacy support: if `name` is passed directly (without firstName/surname), split it
        if (name !== undefined && firstName === undefined && surname === undefined) {
            updates.name = name;
            const parts = name.trim().split(/\s+/);
            updates.firstName = parts[0];
            updates.surname = parts.slice(1).join(' ') || '';
        }

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
