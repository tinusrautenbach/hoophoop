import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { db } from '@/db';
import { users, communityMembers, userActivityLogs, athletes, playerInvitations, playerClaimRequests } from '@/db/schema';
import { eq, desc, and, gt } from 'drizzle-orm';

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch user basic info
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch user's athlete profile
        const playerProfile = await db.query.athletes.findFirst({
            where: eq(athletes.userId, userId),
            with: {
                community: true
            }
        });

        // Fetch user's communities
        const userCommunities = await db.query.communityMembers.findMany({
            where: eq(communityMembers.userId, userId),
            with: {
                community: true
            }
        });

        // Fetch recent activity
        const recentActivity = await db.query.userActivityLogs.findMany({
            where: eq(userActivityLogs.userId, userId),
            limit: 10,
            orderBy: [desc(userActivityLogs.createdAt)]
        });

        // Fetch pending invitations sent by user
        const pendingInvitations = await db.query.playerInvitations.findMany({
            where: and(
                eq(playerInvitations.createdBy, userId),
                eq(playerInvitations.status, 'pending'),
                gt(playerInvitations.expiresAt, new Date())
            ),
            with: {
                athlete: {
                    columns: {
                        id: true,
                        name: true,
                        firstName: true,
                        surname: true,
                    },
                },
            },
            orderBy: [desc(playerInvitations.createdAt)],
        });

        // Fetch pending claim requests made by user
        const pendingClaimRequests = await db.query.playerClaimRequests.findMany({
            where: and(
                eq(playerClaimRequests.userId, userId),
                eq(playerClaimRequests.status, 'pending')
            ),
            with: {
                athlete: {
                    columns: {
                        id: true,
                        name: true,
                        firstName: true,
                        surname: true,
                    },
                },
                community: {
                    columns: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: [desc(playerClaimRequests.requestedAt)],
        });

        return NextResponse.json({
            user: {
                ...user,
                theme: user.theme || 'dark'
            },
            playerProfile,
            communities: userCommunities.map(cm => ({
                ...cm.community,
                role: cm.role
            })),
            activity: recentActivity,
            pendingInvitations,
            pendingClaimRequests,
        });
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
