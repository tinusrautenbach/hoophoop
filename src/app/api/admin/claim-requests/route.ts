import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerClaimRequests, users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: Request) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';
        const communityId = searchParams.get('communityId');

        let whereClause;
        if (status === 'all') {
            whereClause = communityId ? eq(playerClaimRequests.communityId, communityId) : undefined;
        } else if (communityId) {
            whereClause = and(
                eq(playerClaimRequests.status, status),
                eq(playerClaimRequests.communityId, communityId)
            );
        } else {
            whereClause = eq(playerClaimRequests.status, status);
        }

        const claims = await db.select({
            id: playerClaimRequests.id,
            athleteId: playerClaimRequests.athleteId,
            userId: playerClaimRequests.userId,
            status: playerClaimRequests.status,
            communityId: playerClaimRequests.communityId,
            requestedAt: playerClaimRequests.requestedAt,
            reviewedAt: playerClaimRequests.reviewedAt,
            rejectionReason: playerClaimRequests.rejectionReason,
        })
        .from(playerClaimRequests)
        .where(whereClause)
        .orderBy(desc(playerClaimRequests.requestedAt));

        const claimsWithDetails = await Promise.all(
            claims.map(async (claim) => {
                const athlete = await db.query.athletes.findFirst({
                    where: eq((await import('@/db/schema')).athletes.id, claim.athleteId),
                });
                const claimant = await db.query.users.findFirst({
                    where: eq(users.id, claim.userId),
                });
                return {
                    ...claim,
                    athleteName: athlete?.name,
                    claimantName: claimant ? `${claimant.firstName || ''} ${claimant.lastName || ''}`.trim() || claimant.email : 'Unknown',
                    claimantEmail: claimant?.email,
                };
            })
        );

        return NextResponse.json({ claims: claimsWithDetails });
    } catch (error) {
        console.error('Error fetching claim requests:', error);
        return NextResponse.json({ error: 'Failed to fetch claim requests' }, { status: 500 });
    }
}
