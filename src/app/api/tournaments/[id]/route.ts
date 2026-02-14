import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-logger';

// GET - Get tournament details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const tournament = await db.query.tournaments.findFirst({
            where: eq(tournaments.id, id),
            with: {
                community: true,
                pools: {
                    with: {
                        teams: {
                            with: {
                                team: true
                            }
                        },
                        games: {
                            with: {
                                game: true
                            }
                        },
                        standings: {
                            with: {
                                team: true
                            }
                        }
                    }
                },
                teams: {
                    with: {
                        team: true
                    }
                },
                games: {
                    with: {
                        game: true
                    }
                },
                standings: {
                    with: {
                        team: true
                    }
                },
                awards: {
                    with: {
                        athlete: true,
                        team: true
                    }
                }
            }
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        return NextResponse.json(tournament);
    } catch (error) {
        console.error('Error fetching tournament:', error);
        return NextResponse.json({ error: 'Failed to fetch tournament' }, { status: 500 });
    }
}

// PATCH - Update tournament
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    try {
        // Check ownership or community permissions (simplified for now)
        const existing = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, id), eq(tournaments.ownerId, userId))
        });

        if (!existing) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        const [updatedTournament] = await db.update(tournaments)
            .set({
                ...body,
                updatedAt: new Date()
            })
            .where(eq(tournaments.id, id))
            .returning();

        // Log activity
        await logActivity({
            userId,
            action: 'TOURNAMENT_UPDATED',
            resourceType: 'tournament',
            resourceId: id,
            details: body
        });

        return NextResponse.json(updatedTournament);
    } catch (error) {
        console.error('Error updating tournament:', error);
        return NextResponse.json({ error: 'Failed to update tournament' }, { status: 500 });
    }
}

// DELETE - Delete tournament
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        // Check ownership
        const existing = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, id), eq(tournaments.ownerId, userId))
        });

        if (!existing) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        await db.delete(tournaments).where(eq(tournaments.id, id));

        // Log activity
        await logActivity({
            userId,
            action: 'TOURNAMENT_DELETED',
            resourceType: 'tournament',
            resourceId: id
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting tournament:', error);
        return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
    }
}
