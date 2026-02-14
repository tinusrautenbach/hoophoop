import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, communityInvites, communityMembers, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { sendCommunityInvitationEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, role = 'scorer' } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    try {
        // Check permissions
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, id),
            with: { members: true }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        const isOwner = community.ownerId === userId;
        const memberRecord = community.members.find(m => m.userId === userId);
        const isAdmin = memberRecord?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Generate invite
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

        const [invite] = await db.insert(communityInvites)
            .values({
                communityId: id,
                email,
                role,
                token,
                status: 'pending',
                expiresAt
            })
            .returning();

        // Get inviter name for personalization
        const inviter = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        const inviterName = inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || undefined : undefined;

        // Generate invite link
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/communities/join?token=${token}`;

        // Send email notification
        const emailResult = await sendCommunityInvitationEmail(
            email,
            community.name,
            inviteLink,
            role,
            inviterName
        );

        return NextResponse.json({
            invite,
            inviteLink,
            emailSent: emailResult.success,
            emailError: emailResult.error,
        });

    } catch (error) {
        console.error('Error creating invite:', error);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
}
