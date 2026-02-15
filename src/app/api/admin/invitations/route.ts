import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations, athletes, users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and, gt } from 'drizzle-orm';

export async function GET(request: Request) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status') || 'pending';

        const whereClause = statusFilter === 'all' 
            ? undefined 
            : and(
                eq(playerInvitations.status, statusFilter as 'pending' | 'accepted' | 'expired'),
                gt(playerInvitations.expiresAt, new Date())
            );

        const invitations = await db.select({
            id: playerInvitations.id,
            athleteId: playerInvitations.athleteId,
            email: playerInvitations.email,
            token: playerInvitations.token,
            status: playerInvitations.status,
            expiresAt: playerInvitations.expiresAt,
            createdAt: playerInvitations.createdAt,
            createdBy: playerInvitations.createdBy,
            athleteName: athletes.name,
            athleteFirstName: athletes.firstName,
            athleteSurname: athletes.surname,
        })
        .from(playerInvitations)
        .leftJoin(athletes, eq(playerInvitations.athleteId, athletes.id))
        .where(whereClause)
        .orderBy(playerInvitations.createdAt);

        // Fetch creator details for each invitation
        const invitationsWithCreators = await Promise.all(
            invitations.map(async (inv) => {
                const creator = await db.query.users.findFirst({
                    where: eq(users.id, inv.createdBy),
                    columns: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                });
                return {
                    ...inv,
                    creatorName: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email : 'Unknown',
                    creatorEmail: creator?.email,
                };
            })
        );

        return NextResponse.json({ invitations: invitationsWithCreators });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }
}
