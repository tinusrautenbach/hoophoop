import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerClaimRequests, athletes, users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq } from 'drizzle-orm';
import { sendPlayerClaimResultEmail } from '@/lib/email';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await (await import('@/lib/auth-server')).auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: requestId } = await params;

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

        // Approve the claim
        await db.update(playerClaimRequests)
            .set({
                status: 'approved',
                reviewedAt: new Date(),
                reviewedBy: userId,
            })
            .where(eq(playerClaimRequests.id, requestId));

        // Link athlete to user
        await db.update(athletes)
            .set({ userId: claimRequest.userId })
            .where(eq(athletes.id, claimRequest.athleteId));

        // Send email notification to claimant
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
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await (await import('@/lib/auth-server')).auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: requestId } = await params;

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

        // Reject the claim
        await db.update(playerClaimRequests)
            .set({
                status: 'rejected',
                reviewedAt: new Date(),
                reviewedBy: userId,
                rejectionReason: reason,
            })
            .where(eq(playerClaimRequests.id, requestId));

        // Send email notification to claimant
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
