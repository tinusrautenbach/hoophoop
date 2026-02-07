import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, athletes, teamMemberships } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamId = params.id;

    try {
        const members = await db.query.teamMemberships.findMany({
            where: eq(teamMemberships.teamId, teamId),
            with: {
                athlete: true,
            },
        });

        return NextResponse.json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamId = params.id;

    try {
        const body = await request.json();
        const { name, number } = body;

        if (!name) {
            return NextResponse.json({ error: 'Athlete name is required' }, { status: 400 });
        }

        // 1. Create the athlete profile
        const [newAthlete] = await db.insert(athletes).values({
            ownerId: userId,
            name,
        }).returning();

        // 2. Create the team membership
        const [membership] = await db.insert(teamMemberships).values({
            teamId,
            athleteId: newAthlete.id,
            number: number?.toString(),
        }).returning();

        return NextResponse.json({
            ...membership,
            athlete: newAthlete
        });
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
    }
}
