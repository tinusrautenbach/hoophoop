import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityMembers, users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const addMemberSchema = z.object({
    userId: z.string(),
    role: z.enum(['admin', 'scorer', 'viewer']).default('scorer'),
    canManageGames: z.boolean().default(true),
});

// GET - List all members of a community (World Admin only)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: communityId } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId)
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Fetch members with user details using a join
        const membersWithUsers = await db.select({
            member: communityMembers,
            user: users
        })
        .from(communityMembers)
        .leftJoin(users, eq(communityMembers.userId, users.id))
        .where(eq(communityMembers.communityId, communityId));

        return NextResponse.json({
            community: {
                id: community.id,
                name: community.name,
                ownerId: community.ownerId,
            },
            members: membersWithUsers.map(({ member, user }) => ({
                id: member.id,
                userId: member.userId,
                role: member.role,
                canManageGames: member.canManageGames,
                joinedAt: member.joinedAt,
                user: user ? {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    imageUrl: user.imageUrl,
                } : null,
                isOwner: member.userId === community.ownerId,
            }))
        });
    } catch (error) {
        console.error('Error fetching community members:', error);
        return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
}

// POST - Add a user to a community (World Admin only)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: communityId } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId)
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        const body = await request.json();
        const validated = addMemberSchema.parse(body);

        // Check if user exists
        const user = await db.query.users.findFirst({
            where: eq(users.id, validated.userId)
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if already a member
        const existingMember = await db.query.communityMembers.findFirst({
            where: and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, validated.userId)
            )
        });

        if (existingMember) {
            return NextResponse.json({ error: 'User is already a member of this community' }, { status: 409 });
        }

        // Add member
        const [member] = await db.insert(communityMembers)
            .values({
                communityId,
                userId: validated.userId,
                role: validated.role,
                canManageGames: validated.canManageGames,
            })
            .returning();

        return NextResponse.json({
            success: true,
            member: {
                ...member,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    imageUrl: user.imageUrl,
                }
            }
        }, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
        }
        console.error('Error adding member:', error);
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }
}
