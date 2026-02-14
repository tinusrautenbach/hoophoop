import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, teamMemberships, teams, communities } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, ilike, desc, and, or, ne, sql } from 'drizzle-orm';

export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const communityId = searchParams.get('communityId');
        const includeInactive = searchParams.get('includeInactive') === 'true';

        const conditions: ReturnType<typeof eq>[] = [];

        // Status filter: exclude merged players, optionally include inactive
        if (!includeInactive) {
            conditions.push(eq(athletes.status, 'active'));
        } else {
            conditions.push(ne(athletes.status, 'merged'));
        }

        // Search by firstName and/or surname (partial match, case-insensitive)
        if (query && query.length >= 2) {
            const searchTerm = `%${query}%`;
            conditions.push(
                or(
                    ilike(athletes.firstName, searchTerm),
                    ilike(athletes.surname, searchTerm),
                    ilike(athletes.name, searchTerm),
                )!
            );
        }

        // Community scoping: return players in the community + world-available players
        if (communityId) {
            conditions.push(
                or(
                    eq(athletes.communityId, communityId),
                    eq(athletes.isWorldAvailable, true),
                )!
            );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const playerList = await db.query.athletes.findMany({
            where: whereClause,
            with: {
                memberships: {
                    where: eq(teamMemberships.isActive, true),
                    with: {
                        team: {
                            columns: { id: true, name: true, communityId: true },
                        },
                    },
                    limit: 3, // Only show up to 3 current teams in search results
                },
                community: {
                    columns: { id: true, name: true },
                },
            },
            orderBy: [desc(athletes.createdAt)],
            limit: 50,
        });

        return NextResponse.json(playerList);
    } catch (error) {
        console.error('Error searching players:', error);
        return NextResponse.json({ error: 'Failed to search players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { firstName, surname, name, email, birthDate, communityId } = body;

        // Support both new format (firstName + surname) and legacy format (name)
        let resolvedFirstName = firstName;
        let resolvedSurname = surname;
        let resolvedName: string;

        if (firstName && surname !== undefined) {
            resolvedName = `${firstName} ${surname}`.trim();
        } else if (name) {
            // Legacy fallback: split name into firstName/surname
            const parts = name.trim().split(/\s+/);
            resolvedFirstName = parts[0];
            resolvedSurname = parts.slice(1).join(' ') || '';
            resolvedName = name;
        } else {
            return NextResponse.json({ error: 'Player firstName and surname are required' }, { status: 400 });
        }

        if (!resolvedFirstName) {
            return NextResponse.json({ error: 'Player first name is required' }, { status: 400 });
        }

        const [newPlayer] = await db.insert(athletes).values({
            ownerId: userId,
            name: resolvedName,
            firstName: resolvedFirstName,
            surname: resolvedSurname || '',
            email: email || null,
            birthDate: birthDate || null,
            communityId: communityId || null,
            status: 'active',
        }).returning();

        return NextResponse.json(newPlayer);
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
