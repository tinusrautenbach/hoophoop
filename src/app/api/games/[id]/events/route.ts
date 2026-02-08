import { NextResponse } from 'next/server';
import { db } from '@/db';
import { gameEvents, games } from '@/db/schema';
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

    const { id: gameId } = await params;

    try {
        const body = await request.json();
        const { type, player, team, value, description, clockAt, period, metadata } = body;

        // Verify ownership of the game
        const game = await db.query.games.findFirst({
            where: and(
                eq(games.id, gameId),
                eq(games.ownerId, userId)
            )
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found or unauthorized' }, { status: 404 });
        }

        const [newEvent] = await db.insert(gameEvents).values({
            gameId,
            type,
            team,
            player, // Added player field
            value,
            description: description || `${type} by ${player || team}`,
            clockAt: clockAt || game.clockSeconds,
            period: period || game.currentPeriod,
            metadata: metadata || {},
            createdAt: new Date(),
        }).returning();

        return NextResponse.json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
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

    const { id: gameId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
        return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    try {
        // Verify ownership through join
        const event = await db.query.gameEvents.findFirst({
            where: eq(gameEvents.id, eventId),
            with: {
                game: true
            }
        });

        if (!event || event.game.ownerId !== userId || event.gameId !== gameId) {
            return NextResponse.json({ error: 'Unauthorized or event not found' }, { status: 403 });
        }

        await db.delete(gameEvents).where(eq(gameEvents.id, eventId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
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

    const { id: gameId } = await params;

    try {
        const body = await request.json();
        const { id: eventId, type, player, value, description, clockAt, period, metadata } = body;

        if (!eventId) {
            return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
        }

        // Verify ownership through join
        const event = await db.query.gameEvents.findFirst({
            where: eq(gameEvents.id, eventId),
            with: {
                game: true
            }
        });

        if (!event || event.game.ownerId !== userId || event.gameId !== gameId) {
            return NextResponse.json({ error: 'Unauthorized or event not found' }, { status: 403 });
        }

        // Only allow updating specific fields
        const updates: Record<string, unknown> = {};
        if (type !== undefined) updates.type = type;
        if (player !== undefined) updates.player = player;
        if (value !== undefined) updates.value = value;
        if (description !== undefined) updates.description = description;
        if (clockAt !== undefined) updates.clockAt = clockAt;
        if (period !== undefined) updates.period = period;
        if (metadata !== undefined) updates.metadata = metadata;

        const [updatedEvent] = await db.update(gameEvents)
            .set(updates)
            .where(eq(gameEvents.id, eventId))
            .returning();

        return NextResponse.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
}
