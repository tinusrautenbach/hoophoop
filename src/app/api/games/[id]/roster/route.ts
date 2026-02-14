import { NextResponse } from 'next/server';
import { db } from '@/db';
import { gameRosters, games, gameEvents } from '@/db/schema';
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
        // Verify ownership
        const game = await db.query.games.findFirst({
            where: and(eq(games.id, gameId), eq(games.ownerId, userId))
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found or unauthorized' }, { status: 404 });
        }

        const body = await request.json();
        const { name, number, team } = body;

        if (!name || !number || !team) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const [newPlayer] = await db.insert(gameRosters).values({
            gameId,
            name,
            number,
            team,
            isActive: false, // Default to bench when added mid-game
            points: 0,
            fouls: 0
        }).returning();

        // Log event
        await db.insert(gameEvents).values({
            gameId,
            type: 'sub', // Using 'sub' type broadly for roster changes or maybe add a new type?
            team,
            player: name,
            value: 0,
            description: `Roster Amendment: Added ${name} (#${number})`,
            period: game.currentPeriod,
            clockAt: game.clockSeconds
        });

        return NextResponse.json(newPlayer);
    } catch (error) {
        console.error('Error adding roster player:', error);
        return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
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
        // Verify ownership
        const game = await db.query.games.findFirst({
            where: and(eq(games.id, gameId), eq(games.ownerId, userId))
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found or unauthorized' }, { status: 404 });
        }

        const body = await request.json();
        const { id: rosterId, number, name } = body;

        if (!rosterId) {
            return NextResponse.json({ error: 'Roster ID required' }, { status: 400 });
        }

        // Get old values for logging
        const existing = await db.query.gameRosters.findFirst({
            where: eq(gameRosters.id, rosterId)
        });

        if (!existing) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

        const updates: any = {};
        if (number) updates.number = number;
        if (name) updates.name = name;

        const [updatedPlayer] = await db.update(gameRosters)
            .set(updates)
            .where(eq(gameRosters.id, rosterId))
            .returning();

        // Log event if number changed
        if (number && existing.number !== number) {
            await db.insert(gameEvents).values({
                gameId,
                type: 'sub',
                team: existing.team,
                player: existing.name,
                value: 0,
                description: `Roster Amendment: ${existing.name} changed number from #${existing.number} to #${number}`,
                period: game.currentPeriod,
                clockAt: game.clockSeconds
            });
        }

        return NextResponse.json(updatedPlayer);
    } catch (error) {
        console.error('Error updating roster player:', error);
        return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
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
    const rosterId = searchParams.get('rosterId');

    if (!rosterId) {
        return NextResponse.json({ error: 'Roster ID required' }, { status: 400 });
    }

    try {
        // Verify ownership
        const game = await db.query.games.findFirst({
            where: and(eq(games.id, gameId), eq(games.ownerId, userId))
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found or unauthorized' }, { status: 404 });
        }

        const existing = await db.query.gameRosters.findFirst({
            where: eq(gameRosters.id, rosterId)
        });

        if (existing) {
             await db.delete(gameRosters).where(eq(gameRosters.id, rosterId));

             // Log event
             await db.insert(gameEvents).values({
                gameId,
                type: 'sub',
                team: existing.team,
                player: existing.name,
                value: 0,
                description: `Roster Amendment: Removed ${existing.name} (#${existing.number})`,
                period: game.currentPeriod,
                clockAt: game.clockSeconds
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing roster player:', error);
        return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 });
    }
}
