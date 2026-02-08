import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communityInvites, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    try {
        const invite = await db.query.communityInvites.findFirst({
            where: and(
                eq(communityInvites.token, token),
                eq(communityInvites.status, 'pending')
            )
        });

        if (!invite) {
            return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
        }

        if (new Date() > invite.expiresAt) {
            await db.update(communityInvites)
                .set({ status: 'expired' })
                .where(eq(communityInvites.id, invite.id));
            return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
        }

        // Add user to community
        await db.transaction(async (tx) => {
            // Check if already member
            const existingMember = await tx.query.communityMembers.findFirst({
                where: and(
                    eq(communityMembers.communityId, invite.communityId),
                    eq(communityMembers.userId, userId)
                )
            });

            if (!existingMember) {
                await tx.insert(communityMembers).values({
                    communityId: invite.communityId,
                    userId,
                    role: invite.role,
                    canManageGames: true // Default
                });
            }

            // Mark invite accepted
            await tx.update(communityInvites)
                .set({ status: 'accepted' })
                .where(eq(communityInvites.id, invite.id));
        });

        return NextResponse.json({ success: true, communityId: invite.communityId });

    } catch (error) {
        console.error('Error joining community:', error);
        return NextResponse.json({ error: 'Failed to join community' }, { status: 500 });
    }
}
