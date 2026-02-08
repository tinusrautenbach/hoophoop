import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// GET - Get single community details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, id),
            with: {
                members: true,
                teams: true,
                games: {
                    limit: 10,
                    orderBy: (games, { desc }) => [desc(games.createdAt)]
                }
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Check access rights
        const isOwner = community.ownerId === userId;
        const isMember = community.members.some(m => m.userId === userId);

        if (!isOwner && !isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(community);
    } catch (error) {
        console.error('Error fetching community:', error);
        return NextResponse.json({ error: 'Failed to fetch community' }, { status: 500 });
    }
}

// PATCH - Update community details
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, id),
            with: {
                members: true
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Only admins can update
        const isOwner = community.ownerId === userId;
        const memberRecord = community.members.find(m => m.userId === userId);
        const isAdmin = memberRecord?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, type } = body;
        
        await db.update(communities)
            .set({ name, type })
            .where(eq(communities.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating community:', error);
        return NextResponse.json({ error: 'Failed to update community' }, { status: 500 });
    }
}
