import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameScorerInvites, gameScorers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// GET - Validate a scorer invite token (public — shown before login)
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    try {
        const invite = await db.query.gameScorerInvites.findFirst({
            where: eq(gameScorerInvites.token, token),
            with: { game: true },
        });

        if (!invite) {
            return NextResponse.json({ valid: false, error: 'Invalid invite token' }, { status: 404 });
        }

        const expired = new Date() > invite.expiresAt || invite.status === 'expired';
        const accepted = invite.status === 'accepted';

        return NextResponse.json({
            valid: invite.status === 'pending' && !expired,
            gameId: invite.gameId,
            gameName: invite.game?.name || null,
            role: invite.role,
            email: invite.email,
            expired,
            accepted,
        });

    } catch (error) {
        console.error('Error validating scorer invite:', error);
        return NextResponse.json({ valid: false, error: 'Failed to validate token' }, { status: 500 });
    }
}

// POST - Accept a scorer invite (requires auth)
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;

    try {
        const invite = await db.query.gameScorerInvites.findFirst({
            where: and(
                eq(gameScorerInvites.token, token),
                eq(gameScorerInvites.status, 'pending')
            ),
        });

        if (!invite) {
            return NextResponse.json({ error: 'Invalid or already used invite' }, { status: 404 });
        }

        if (new Date() > invite.expiresAt) {
            await db.update(gameScorerInvites)
                .set({ status: 'expired' })
                .where(eq(gameScorerInvites.id, invite.id));
            return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
        }

        // Verify the game still exists
        const game = await db.query.games.findFirst({
            where: eq(games.id, invite.gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // If user is already the owner, no need to add as scorer
        if (game.ownerId === userId) {
            await db.update(gameScorerInvites)
                .set({ status: 'accepted', acceptedBy: userId })
                .where(eq(gameScorerInvites.id, invite.id));
            return NextResponse.json({ success: true, gameId: invite.gameId, alreadyOwner: true });
        }

        await db.transaction(async (tx) => {
            // Check if already a scorer
            const existing = await tx.query.gameScorers.findFirst({
                where: and(
                    eq(gameScorers.gameId, invite.gameId),
                    eq(gameScorers.userId, userId)
                ),
            });

            if (!existing) {
                await tx.insert(gameScorers).values({
                    gameId: invite.gameId,
                    userId,
                    role: invite.role,
                });
            }

            // Mark invite accepted
            await tx.update(gameScorerInvites)
                .set({ status: 'accepted', acceptedBy: userId })
                .where(eq(gameScorerInvites.id, invite.id));
        });

        return NextResponse.json({ success: true, gameId: invite.gameId });

    } catch (error) {
        console.error('Error accepting scorer invite:', error);
        return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
    }
}
