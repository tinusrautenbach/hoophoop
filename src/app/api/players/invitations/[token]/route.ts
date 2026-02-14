import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations, athletes } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const invitation = await db.query.playerInvitations.findFirst({
            where: eq(playerInvitations.token, token),
            with: {
                athlete: {
                    columns: {
                        id: true,
                        name: true,
                        firstName: true,
                        surname: true,
                    },
                },
            },
        });

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Check if expired
        if (new Date() > invitation.expiresAt) {
            return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 });
        }

        return NextResponse.json(invitation);
    } catch (error) {
        console.error('Error fetching invitation:', error);
        return NextResponse.json({ error: 'Failed to fetch invitation' }, { status: 500 });
    }
}
