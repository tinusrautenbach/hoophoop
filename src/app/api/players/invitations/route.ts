import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, gt } from 'drizzle-orm';

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const invitations = await db.query.playerInvitations.findMany({
            where: and(
                eq(playerInvitations.createdBy, userId),
                eq(playerInvitations.status, 'pending'),
                gt(playerInvitations.expiresAt, new Date())
            ),
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
            orderBy: (playerInvitations, { desc }) => [desc(playerInvitations.createdAt)],
        });

        return NextResponse.json(invitations);
    } catch (error) {
        console.error('Error fetching pending invitations:', error);
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }
}
