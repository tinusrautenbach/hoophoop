import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, users, communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNotNull } from 'drizzle-orm';

// POST /api/communities/[id]/deleted-games/[gameId]/restore - Restore a deleted game
// Accessible by: community owner, community admin, or world admin
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; gameId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId, gameId } = await params;

    try {
        // Check permissions
        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId),
            with: {
                members: true,
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Check if user has permission (world admin, community owner, or community admin)
        const isWorldAdmin = currentUser?.isWorldAdmin;
        const isCommunityOwner = community.ownerId === userId;
        const isCommunityAdmin = community.members?.some(
            (m: any) => m.userId === userId && m.role === 'admin'
        );

        if (!isWorldAdmin && !isCommunityOwner && !isCommunityAdmin) {
            return NextResponse.json({ error: 'Forbidden - Community admin or owner required' }, { status: 403 });
        }

        // Check if game exists, is deleted, and belongs to this community
        const game = await db.query.games.findFirst({
            where: and(
                eq(games.id, gameId),
                eq(games.communityId, communityId),
                isNotNull(games.deletedAt)
            ),
        });

        if (!game) {
            return NextResponse.json({ error: 'Deleted game not found in this community' }, { status: 404 });
        }

        // Restore the game by clearing deletedAt
        await db.update(games)
            .set({ deletedAt: null })
            .where(eq(games.id, gameId));

        return NextResponse.json({ success: true, message: 'Game restored' });
    } catch (error) {
        console.error('Error restoring game:', error);
        return NextResponse.json({ error: 'Failed to restore game' }, { status: 500 });
    }
}
