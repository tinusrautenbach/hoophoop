import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, gameScorerInvites, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { sendScorerInviteEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: gameId } = await params;
    const body = await request.json();
    const { email, role = 'co_scorer' } = body;

    try {
        // Verify game exists and caller is the owner
        const game = await db.query.games.findFirst({
            where: eq(games.id, gameId),
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.ownerId !== userId) {
            return NextResponse.json({ error: 'Only the game owner can invite scorers' }, { status: 403 });
        }

        // Generate invite token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

        const [invite] = await db.insert(gameScorerInvites)
            .values({
                gameId,
                email: email || null,
                token,
                status: 'pending',
                role,
                createdBy: userId,
                expiresAt,
            })
            .returning();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteLink = `${appUrl}/game/join-scorer?token=${token}`;

        let emailSent = false;
        let emailError: string | undefined;

        if (email) {
            // Get inviter name for personalisation
            const inviter = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });
            const inviterName = inviter
                ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || undefined
                : undefined;

            const gameName = game.name || 'a game';
            const emailResult = await sendScorerInviteEmail(email, gameName, inviteLink, inviterName);
            emailSent = emailResult.success;
            emailError = emailResult.error;
        }

        return NextResponse.json({ invite, inviteLink, emailSent, emailError }, { status: 201 });

    } catch (error) {
        console.error('Error creating scorer invite:', error);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
}
