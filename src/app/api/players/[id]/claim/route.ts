import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, playerClaimRequests, communityMembers, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';
import { sendPlayerClaimRequestEmail, sendPlayerClaimResultEmail } from '@/lib/email';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: playerId } = await params;

    try {
        const player = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        if (player.userId) {
            return NextResponse.json({ error: 'Player profile already claimed' }, { status: 400 });
        }

        // Check for any existing pending request for this athlete by any user
        const existingRequest = await db.query.playerClaimRequests.findFirst({
            where: and(
                eq(playerClaimRequests.athleteId, playerId),
                eq(playerClaimRequests.status, 'pending')
            ),
        });

        // If there's an existing pending request, reject it
        if (existingRequest) {
            // Reject the old request
            await db.update(playerClaimRequests)
                .set({
                    status: 'rejected',
                    reviewedAt: new Date(),
                    reviewedBy: 'system',
                    rejectionReason: 'Superseded by new claim request',
                })
                .where(eq(playerClaimRequests.id, existingRequest.id));

            // Send rejection email to the previous claimant
            const previousClaimant = await db.query.users.findFirst({
                where: eq(users.id, existingRequest.userId),
            });

            if (previousClaimant?.email) {
                await sendPlayerClaimResultEmail(
                    previousClaimant.email,
                    player.name,
                    false,
                    'Your claim request was superseded by a newer request. Only one pending claim is allowed per player profile at a time.'
                );
            }
        }

        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        const claimRequest = await db.insert(playerClaimRequests)
            .values({
                athleteId: playerId,
                userId,
                status: 'pending',
                communityId: player.communityId,
            })
            .returning();

        if (player.communityId) {
            const communityAdmins = await db.query.communityMembers.findMany({
                where: and(
                    eq(communityMembers.communityId, player.communityId),
                    eq(communityMembers.role, 'admin')
                ),
                with: {
                    user: true
                }
            });

            for (const admin of communityAdmins) {
                if (admin.user?.email) {
                    const approveLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/communities/${player.communityId}/claim-requests/${claimRequest[0].id}/approve`;
                    const rejectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/communities/${player.communityId}/claim-requests/${claimRequest[0].id}/reject`;

                    await sendPlayerClaimRequestEmail(
                        admin.user.email,
                        `${admin.user.firstName || 'Admin'}`,
                        player.name,
                        `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'User',
                        player.communityId ? 'Community' : null,
                        approveLink,
                        rejectLink
                    );
                }
            }
        } else {
            const worldAdmins = await db.query.users.findMany({
                where: eq(users.isWorldAdmin, true)
            });

            for (const admin of worldAdmins) {
                if (admin.email) {
                    const approveLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/claim-requests/${claimRequest[0].id}/approve`;
                    const rejectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/claim-requests/${claimRequest[0].id}/reject`;

                    await sendPlayerClaimRequestEmail(
                        admin.email,
                        `${admin.firstName || 'Admin'}`,
                        player.name,
                        `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'User',
                        null,
                        approveLink,
                        rejectLink
                    );
                }
            }
        }

        return NextResponse.json({ success: true, requestId: claimRequest[0].id });
    } catch (error) {
        console.error('Error creating claim request:', error);
        return NextResponse.json({ error: 'Failed to create claim request' }, { status: 500 });
    }
}
