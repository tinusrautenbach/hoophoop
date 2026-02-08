import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId, userId: targetUserId } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId),
            with: { members: true }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        const isOwner = community.ownerId === currentUserId;
        const memberRecord = community.members.find(m => m.userId === currentUserId);
        const isAdmin = memberRecord?.role === 'admin';
        const isSelf = currentUserId === targetUserId;

        // Can delete if: Owner, Admin (removing non-owner), or Self (leave)
        if (!isOwner && !isAdmin && !isSelf) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Cannot remove owner
        if (targetUserId === community.ownerId) {
            return NextResponse.json({ error: 'Cannot remove community owner' }, { status: 403 });
        }

        await db.delete(communityMembers)
            .where(and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, targetUserId)
            ));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error removing member:', error);
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }
}
