import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateMemberSchema = z.object({
    role: z.enum(['admin', 'scorer', 'viewer']),
    canManageGames: z.boolean().optional(),
});

// PATCH - Update a member's role in a community (World Admin only)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: communityId, userId: targetUserId } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId)
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Cannot modify owner role
        if (targetUserId === community.ownerId) {
            return NextResponse.json({ error: 'Cannot modify community owner' }, { status: 403 });
        }

        // Check if target is a member
        const targetMember = await db.query.communityMembers.findFirst({
            where: and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, targetUserId)
            )
        });

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

// DELETE - Remove a user from a community (World Admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: communityId, userId: targetUserId } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId)
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Cannot remove owner
        if (targetUserId === community.ownerId) {
            return NextResponse.json({ error: 'Cannot remove community owner. Transfer ownership first.' }, { status: 403 });
        }

        const result = await db.delete(communityMembers)
            .where(and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, targetUserId)
            ))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'User is not a member of this community' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Member removed successfully' });

    } catch (error) {
        console.error('Error removing member:', error);
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }
}
