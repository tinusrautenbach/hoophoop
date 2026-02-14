import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameRosters, communities, communityMembers, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: gameId } = await params;

    try {
        const game = await db.query.games.findFirst({
            where: and(
                eq(games.id, gameId),
                isNull(games.deletedAt)
            ),
            with: {
                rosters: true,
                events: {
                    orderBy: (events, { desc }) => [desc(events.createdAt)]
                },
                community: {
                    with: {
                        members: true
                    }
                }
            }
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        return NextResponse.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
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
    const body = await request.json();

    try {
        // Verify ownership or admin permissions
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
            with: {
                community: {
                    with: {
                        members: true
                    }
                }
            }
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Check permissions: game owner, community owner, community admin, or world admin
        const isGameOwner = game.ownerId === userId;
        const isCommunityOwner = game.community?.ownerId === userId;
        const isCommunityAdmin = game.community?.members?.some(
            (m: { userId: string; role: string }) => m.userId === userId && m.role === 'admin'
        );
        const isAdmin = await isWorldAdmin();

        if (!isGameOwner && !isCommunityOwner && !isCommunityAdmin && !isAdmin) {
            return NextResponse.json({ error: 'Only the game owner, community owner, community admin, or world admin can edit game settings' }, { status: 403 });
        }

        // Handle game updates
        const { rosters: updatedRosters, ...gameUpdates } = body;

        // Validate visibility if provided
        if (gameUpdates.visibility) {
            const validVisibilities = ['private', 'public_general', 'public_community'];
            if (!validVisibilities.includes(gameUpdates.visibility)) {
                return NextResponse.json(
                    { error: 'Invalid visibility value' },
                    { status: 400 }
                );
            }
        }

        // Convert scheduledDate string to Date if provided
        if (gameUpdates.scheduledDate && typeof gameUpdates.scheduledDate === 'string') {
            gameUpdates.scheduledDate = new Date(gameUpdates.scheduledDate);
        }

        await db.transaction(async (tx) => {
            if (Object.keys(gameUpdates).length > 0) {
                await tx.update(games)
                    .set({ ...gameUpdates, updatedAt: new Date() })
                    .where(eq(games.id, gameId));
            }

            if (updatedRosters && Array.isArray(updatedRosters)) {
                for (const r of updatedRosters) {
                    await tx.update(gameRosters)
                        .set({
                            points: r.points,
                            fouls: r.fouls,
                            isActive: r.isActive
                        })
                        .where(eq(gameRosters.id, r.id));
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating game:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update game';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// DELETE - Soft delete a game (game owner or community admin)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;

    try {
        // Fetch game with community info
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
            with: {
                community: {
                    with: {
                        members: true,
                    }
                }
            }
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Check if user can delete this game
        const isOwner = game.ownerId === userId;
        const isCommunityOwner = game.community?.ownerId === userId;
        const isCommunityAdmin = game.community?.members?.some(
            (m: any) => m.userId === userId && m.role === 'admin'
        );

        if (!isOwner && !isCommunityOwner && !isCommunityAdmin) {
            return NextResponse.json({ error: 'Forbidden - Only game owner or community admin can delete' }, { status: 403 });
        }

        // Soft delete the game
        await db.update(games)
            .set({ deletedAt: new Date() })
            .where(eq(games.id, gameId));

        return NextResponse.json({ success: true, message: 'Game deleted' });
    } catch (error) {
        console.error('Error deleting game:', error);
        return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
    }
}
