import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { db } from '@/db';
import { users, communityMembers, communities, userActivityLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

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

        return NextResponse.json({
            user: {
                ...user,
                theme: user.theme || 'dark'
            },
            communities: userCommunities.map(cm => ({
                ...cm.community,
                role: cm.role
            })),
            activity: recentActivity
        });
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
