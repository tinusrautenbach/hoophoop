import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerClaimRequests, athletes, users, communityMembers } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and } from 'drizzle-orm';
import { sendPlayerClaimResultEmail } from '@/lib/email';

async function checkAdminAccess(communityId: string, userId: string): Promise<boolean> {
    const isAdmin = await isWorldAdmin();
    if (isAdmin) return true;
    
    const membership = await db.query.communityMembers.findFirst({
        where: and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, userId),
            eq(communityMembers.role, 'admin')
        ),
    });
    return !!membership;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; requestId: string }> }
) {
    const { userId } = await (await import('@/lib/auth-server')).auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId, requestId } = await params;

    const hasAccess = await checkAdminAccess(communityId, userId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const claimRequest = await db.query.playerClaimRequests.findFirst({
            where: eq(playerClaimRequests.id, requestId),
            with: {
                athlete: true
            }
        });

        if (!claimRequest) {
            return NextResponse.json({ error: 'Claim request not found' }, { status: 404 });
        }

        if (claimRequest.status !== 'pending') {
            return NextResponse.json({ error: 'Claim request already processed' }, { status: 400 });
        }

        await db.update(playerClaimRequests)
            .set({
                status: 'approved',
                reviewedAt: new Date(),
                reviewedBy: userId,
            })
            .where(eq(playerClaimRequests.id, requestId));

        await db.update(athletes)
            .set({ userId: claimRequest.userId })
            .where(eq(athletes.id, claimRequest.athleteId));

        const claimant = await db.query.users.findFirst({
            where: eq(users.id, claimRequest.userId),
        });

        if (claimant?.email && claimRequest.athlete) {
            await sendPlayerClaimResultEmail(
                claimant.email,
                claimRequest.athlete.name,
                true
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error approving claim request:', error);
        return NextResponse.json({ error: 'Failed to approve claim request' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; requestId: string }> }
) {
    const { userId } = await (await import('@/lib/auth-server')).auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId, requestId } = await params;

    const hasAccess = await checkAdminAccess(communityId, userId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const reason = body.reason || 'No reason provided';

        const claimRequest = await db.query.playerClaimRequests.findFirst({
            where: eq(playerClaimRequests.id, requestId),
            with: {
                athlete: true
            }
        });

        if (!claimRequest) {
            return NextResponse.json({ error: 'Claim request not found' }, { status: 404 });
        }

        if (claimRequest.status !== 'pending') {
            return NextResponse.json({ error: 'Claim request already processed' }, { status: 400 });
        }

        await db.update(playerClaimRequests)
            .set({
                status: 'rejected',
                reviewedAt: new Date(),
                reviewedBy: userId,
                rejectionReason: reason,
            })
            .where(eq(playerClaimRequests.id, requestId));

        const claimant = await db.query.users.findFirst({
            where: eq(users.id, claimRequest.userId),
        });

        if (claimant?.email && claimRequest.athlete) {
            await sendPlayerClaimResultEmail(
                claimant.email,
                claimRequest.athlete.name,
                false,
                reason
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error rejecting claim request:', error);
        return NextResponse.json({ error: 'Failed to reject claim request' }, { status: 500 });
    }
}
