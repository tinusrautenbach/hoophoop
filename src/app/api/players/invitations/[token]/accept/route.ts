import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations, athletes } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

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

        // Find the invitation
        const invitation = await db.query.playerInvitations.findFirst({
            where: eq(playerInvitations.token, token),
            with: {
                athlete: true,
            },
        });

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Check if invitation has expired
        if (new Date() > invitation.expiresAt) {
            return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
        }

        // Check if invitation has already been accepted
        if (invitation.status === 'accepted') {
            return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 });
        }

        // Link the athlete profile to the user
        if (invitation.athleteId) {
            await db.update(athletes)
                .set({
                    userId,
                    invitedBy: invitation.createdBy,
                    invitedAt: new Date(),
                })
                .where(eq(athletes.id, invitation.athleteId));
        }

        // Mark invitation as accepted
        await db.update(playerInvitations)
            .set({ status: 'accepted' })
            .where(eq(playerInvitations.id, invitation.id));

        return NextResponse.json({
            success: true,
            athlete: invitation.athlete,
        });
    } catch (error) {
        console.error('Error accepting player invitation:', error);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }
}
