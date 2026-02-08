import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, or } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-logger';

// GET - List user's communities
export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch communities where user is owner OR member
        // Since Drizzle query builder is tricky with complex ORs across relations,
        // let's fetch membership IDs first
        const memberships = await db.query.communityMembers.findMany({
            where: eq(communityMembers.userId, userId),
            columns: { communityId: true }
        });
        
        const memberCommunityIds = memberships.map(m => m.communityId);
        
        // Use inArray or ownerId check
        const userCommunities = await db.query.communities.findMany({
            where: (communities, { eq, or, inArray }) => {
                const conditions = [eq(communities.ownerId, userId)];
                if (memberCommunityIds.length > 0) {
                    conditions.push(inArray(communities.id, memberCommunityIds));
                }
                return or(...conditions);
            },
            with: {
                members: true,
            }
        });

        return NextResponse.json(userCommunities);
    } catch (error) {
        console.error('Error fetching communities:', error);
        return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
    }
}

// POST - Create a new community
export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type = 'other' } = body;

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    try {
        const [newCommunity] = await db.transaction(async (tx) => {
            // Create community
            const [community] = await tx.insert(communities)
                .values({
                    name,
                    type,
                    ownerId: userId,
                })
                .returning();

            // Add owner as admin member
            await tx.insert(communityMembers)
                .values({
                    communityId: community.id,
                    userId: userId,
                    role: 'admin',
                    canManageGames: true,
                });

            return [community];
        });

        // Log activity
        await logActivity({
            userId,
            action: 'COMMUNITY_CREATED',
            resourceType: 'community',
            resourceId: newCommunity.id,
            details: { name, type }
        });

        return NextResponse.json(newCommunity, { status: 201 });
    } catch (error) {
        console.error('Error creating community:', error);
        return NextResponse.json({ error: 'Failed to create community' }, { status: 500 });
    }
}
