import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerClaimRequests, athletes, users, communityMembers } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await (await import('@/lib/auth-server')).auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId } = await params;

    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        const membership = await db.query.communityMembers.findFirst({
            where: and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, userId),
                eq(communityMembers.role, 'admin')
            ),
        });
        if (!membership) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';

        const claims = await db.select({
            id: playerClaimRequests.id,
            athleteId: playerClaimRequests.athleteId,
            userId: playerClaimRequests.userId,
            status: playerClaimRequests.status,
            requestedAt: playerClaimRequests.requestedAt,
            reviewedAt: playerClaimRequests.reviewedAt,
            rejectionReason: playerClaimRequests.rejectionReason,
            athleteName: athletes.name,
            athleteFirstName: athletes.firstName,
            athleteSurname: athletes.surname,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
        })
        .from(playerClaimRequests)
        .leftJoin(athletes, eq(playerClaimRequests.athleteId, athletes.id))
        .leftJoin(users, eq(playerClaimRequests.userId, users.id))
        .where(
            status === 'all' 
                ? eq(playerClaimRequests.communityId, communityId)
                : and(
                    eq(playerClaimRequests.communityId, communityId),
                    eq(playerClaimRequests.status, status)
                )
        )
        .orderBy(desc(playerClaimRequests.requestedAt));

        return NextResponse.json({ claims });
    } catch (error) {
        console.error('Error fetching claim requests:', error);
        return NextResponse.json({ error: 'Failed to fetch claim requests' }, { status: 500 });
    }
}
