import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateMemberSchema = z.object({
    role: z.enum(['admin', 'scorer', 'viewer']),
    canManageGames: z.boolean().optional(),
});

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

export async function PATCH(
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

        const isWorldAdminUser = await isWorldAdmin();
        const isOwner = community.ownerId === currentUserId;
        const memberRecord = community.members.find(m => m.userId === currentUserId);
        const isAdmin = memberRecord?.role === 'admin';

        // Can update if: World Admin, Owner, or Community Admin
        if (!isWorldAdminUser && !isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Cannot modify owner role
        if (targetUserId === community.ownerId) {
            return NextResponse.json({ error: 'Cannot modify community owner' }, { status: 403 });
        }

        // Check if target is a member
        const targetMember = community.members.find(m => m.userId === targetUserId);
        if (!targetMember) {
            return NextResponse.json({ error: 'User is not a member of this community' }, { status: 404 });
        }

        const body = await request.json();
        const validated = updateMemberSchema.parse(body);

        const updateData: { role?: 'admin' | 'scorer' | 'viewer'; canManageGames?: boolean } = {
            role: validated.role,
        };
        if (validated.canManageGames !== undefined) {
            updateData.canManageGames = validated.canManageGames;
        }

        const [updatedMember] = await db.update(communityMembers)
            .set(updateData)
            .where(and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, targetUserId)
            ))
            .returning();

        return NextResponse.json({ success: true, member: updatedMember });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
        }
        console.error('Error updating member:', error);
        return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }
}
