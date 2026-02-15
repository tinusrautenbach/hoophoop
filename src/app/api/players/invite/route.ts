import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerInvitations, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { sendPlayerInvitationEmail } from '@/lib/email';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { athleteId, email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // If athleteId is provided, verify the athlete exists and is not already claimed
        let athleteName = 'Player';
        if (athleteId) {
            const athlete = await db.query.athletes.findFirst({
                where: (athletes, { eq }) => eq(athletes.id, athleteId),
            });

            if (!athlete) {
                return NextResponse.json({ error: 'Player not found' }, { status: 404 });
            }
            
            // Check if athlete is already linked to a user
            if (athlete.userId) {
                return NextResponse.json({ error: 'Player profile is already claimed' }, { status: 400 });
            }
            
            athleteName = athlete.name || athlete.firstName || 'Player';
        }

        // Generate a unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Set expiration to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const [invitation] = await db.insert(playerInvitations).values({
            athleteId: athleteId || null,
            email,
            token,
            status: 'pending',
            expiresAt,
            createdBy: userId,
        }).returning();

        // Get inviter name for personalization
        const inviter = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        const inviterName = inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || undefined : undefined;

        // Generate invitation link
        const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/player/${token}`;

        // Send email notification
        const emailResult = await sendPlayerInvitationEmail(
            email,
            athleteName,
            invitationLink,
            inviterName
        );

        return NextResponse.json({
            ...invitation,
            invitationLink,
            emailSent: emailResult.success,
            emailError: emailResult.error,
        });
    } catch (error) {
        console.error('Error creating player invitation:', error);
        return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }
}

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const invitations = await db.query.playerInvitations.findMany({
            where: (playerInvitations, { eq }) => eq(playerInvitations.createdBy, userId),
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
            orderBy: (playerInvitations, { desc }) => [desc(playerInvitations.createdAt)],
        });

        return NextResponse.json(invitations);
    } catch (error) {
        console.error('Error fetching player invitations:', error);
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }
}
