import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations, athletes, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { sendPlayerInvitationEmail } from '@/lib/email';
import { eq, and } from 'drizzle-orm';

// Resend invitation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { token } = await params;

        const invitation = await db.query.playerInvitations.findFirst({
            where: eq(playerInvitations.token, token),
            with: {
                athlete: true,
            },
        });

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Check ownership
        if (invitation.createdBy !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
        }

        // Update expiration (extend by 7 days from now)
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await db.update(playerInvitations)
            .set({ expiresAt: newExpiresAt })
            .where(eq(playerInvitations.id, invitation.id));

        // Get inviter name
        const inviter = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        const inviterName = inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || undefined : undefined;

        // Generate new link
        const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/player/${token}`;

        // Resend email
        const emailResult = await sendPlayerInvitationEmail(
            invitation.email,
            invitation.athlete?.name || 'Player',
            invitationLink,
            inviterName
        );

        return NextResponse.json({
            success: true,
            emailSent: emailResult.success,
            emailError: emailResult.error,
            newExpiresAt,
        });
    } catch (error) {
        console.error('Error resending invitation:', error);
        return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
    }
}

// Cancel/revoke invitation
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { token } = await params;

        const invitation = await db.query.playerInvitations.findFirst({
            where: eq(playerInvitations.token, token),
        });

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Check ownership
        if (invitation.createdBy !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            return NextResponse.json({ error: 'Cannot cancel accepted invitation' }, { status: 400 });
        }

        // Delete or mark as expired
        await db.delete(playerInvitations)
            .where(eq(playerInvitations.id, invitation.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error canceling invitation:', error);
        return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }
}
