import { NextResponse } from 'next/server';
import { db } from '@/db';
import { gameEvents, games, gameRosters } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, sql } from 'drizzle-orm';
import { graphqlRequest } from '@/lib/hasura/client';
import { logActivity } from '@/lib/activity-logger';

const UPSERT_GAME_STATE_MUTATION = `
  mutation UpsertGameStateAfterEventDelete(
    $gameId: uuid!
    $homeScore: Int!
    $guestScore: Int!
    $homeFouls: Int!
    $guestFouls: Int!
    $updatedAt: timestamptz!
  ) {
    insertGameStatesOne(
      object: {
        gameId: $gameId
        homeScore: $homeScore
        guestScore: $guestScore
        homeFouls: $homeFouls
        guestFouls: $guestFouls
        updatedAt: $updatedAt
      }
      on_conflict: {
        constraint: game_states_pkey
        update_columns: [homeScore, guestScore, homeFouls, guestFouls, updatedAt]
      }
    ) {
      gameId
    }
  }
`;
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

        // Log activity (non-fatal — don't block the response if logging fails)
        try {
            await logActivity({
                userId,
                action: 'GAME_SCORED',
                resourceType: 'game',
                resourceId: gameId,
                details: { eventType: type, team, player, value },
            });
        } catch (logError) {
            console.error('Failed to log GAME_SCORED activity:', logError);
        }

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

        // Recalculate stats if needed
        if (event.type === 'score' && event.value) {
            // Update Game Score
            const scoreField = event.team === 'home' ? games.homeScore : games.guestScore;
            await db.update(games)
                .set({ 
                    [event.team === 'home' ? 'homeScore' : 'guestScore']: sql`${scoreField} - ${event.value}` 
                })
                .where(eq(games.id, gameId));

            // Update Player Stats
            if (event.player) {
                await db.update(gameRosters)
                    .set({ points: sql`${gameRosters.points} - ${event.value}` })
                    .where(and(
                        eq(gameRosters.gameId, gameId),
                        eq(gameRosters.name, event.player),
                        eq(gameRosters.team, event.team!)
                    ));
            }
        } else if (event.type === 'foul') {
             // Update Game Fouls
             const foulField = event.team === 'home' ? games.homeFouls : games.guestFouls;
             await db.update(games)
                 .set({ 
                     [event.team === 'home' ? 'homeFouls' : 'guestFouls']: sql`GREATEST(${foulField} - 1, 0)` 
                 })
                 .where(eq(games.id, gameId));
 
             // Update Player Fouls
             if (event.player) {
                 await db.update(gameRosters)
                     .set({ fouls: sql`GREATEST(${gameRosters.fouls} - 1, 0)` })
                     .where(and(
                         eq(gameRosters.gameId, gameId),
                         eq(gameRosters.name, event.player),
                         eq(gameRosters.team, event.team!)
                     ));
             }
        }

        await db.delete(gameEvents).where(eq(gameEvents.id, eventId));

        // Sync updated scores/fouls to Hasura game_states so real-time subscribers see the change
        const updatedGame = await db.query.games.findFirst({
            where: eq(games.id, gameId),
            columns: {
                homeScore: true,
                guestScore: true,
                homeFouls: true,
                guestFouls: true
            }
        });

        if (updatedGame) {
            try {
                await graphqlRequest(UPSERT_GAME_STATE_MUTATION, {
                    gameId,
                    homeScore: updatedGame.homeScore,
                    guestScore: updatedGame.guestScore,
                    homeFouls: updatedGame.homeFouls,
                    guestFouls: updatedGame.guestFouls,
                    updatedAt: new Date().toISOString(),
                });
            } catch (hasuraError) {
                // Non-fatal: log but don't fail the request — Postgres is the source of truth
                console.error('Failed to sync game state to Hasura after event delete:', hasuraError);
            }
        }

        return NextResponse.json({ success: true, game: updatedGame });
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
