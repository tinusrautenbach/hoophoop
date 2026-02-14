import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, athletes, teamMemberships, playerHistory, communities } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: teamId } = await params;

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
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: teamId } = await params;

    try {
        const body = await request.json();
        const { athleteId, firstName, surname, name, number, communityId, birthDate, email } = body;

        let athlete;
        let isNewAthlete = false;

        if (athleteId) {
            // Existing athlete selected from search
            athlete = await db.query.athletes.findFirst({
                where: eq(athletes.id, athleteId),
            });
            if (!athlete) {
                return NextResponse.json({ error: 'Player not found' }, { status: 404 });
            }
        } else if (firstName || name) {
            // Create a new athlete
            let resolvedFirstName: string;
            let resolvedSurname: string;
            let resolvedName: string;

            if (firstName) {
                // New format: firstName + surname
                resolvedFirstName = firstName;
                resolvedSurname = surname || '';
                resolvedName = `${firstName} ${resolvedSurname}`.trim();
            } else if (name) {
                // Legacy format: single name field
                const parts = name.trim().split(/\s+/);
                resolvedFirstName = parts[0];
                resolvedSurname = parts.slice(1).join(' ') || '';
                resolvedName = name;
            } else {
                return NextResponse.json({ error: 'Player first name is required' }, { status: 400 });
            }

            // Try to find existing athlete by exact name match (legacy compat)
            athlete = await db.query.athletes.findFirst({
                where: eq(athletes.name, resolvedName),
            });

            if (!athlete) {
                const [newAthlete] = await db.insert(athletes).values({
                    ownerId: userId,
                    name: resolvedName,
                    firstName: resolvedFirstName,
                    surname: resolvedSurname,
                    email: email || null,
                    birthDate: birthDate || null,
                    communityId: communityId || null,
                    status: 'active',
                }).returning();
                athlete = newAthlete;
                isNewAthlete = true;
            }
        } else {
            return NextResponse.json({ error: 'Athlete ID or player name is required' }, { status: 400 });
        }

        const existingMembership = await db.query.teamMemberships.findFirst({
            where: and(
                eq(teamMemberships.teamId, teamId),
                eq(teamMemberships.athleteId, athlete.id),
                isNull(teamMemberships.endDate)
            ),
        });

        if (existingMembership) {
            return NextResponse.json({ error: 'Player is already on this team' }, { status: 409 });
        }

        const [membership] = await db.insert(teamMemberships).values({
            teamId,
            athleteId: athlete.id,
            number: number?.toString(),
            communityId: communityId || null,
            createdBy: userId,
            isActive: true,
        }).returning();

        await db.insert(playerHistory).values({
            athleteId: athlete.id,
            teamId,
            action: isNewAthlete ? 'added' : 'transferred',
            newValue: number?.toString() || null,
            performedBy: userId,
            notes: isNewAthlete ? 'New player profile created' : 'Player added to team',
        });

        const fullMembership = await db.query.teamMemberships.findFirst({
            where: eq(teamMemberships.id, membership.id),
            with: { athlete: true },
        });

        return NextResponse.json(fullMembership);
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
    }
}
