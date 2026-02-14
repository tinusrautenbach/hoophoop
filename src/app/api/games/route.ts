import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, teamMemberships, gameRosters, communityMembers, users, teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, desc, or, inArray, isNull, and } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-logger';

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get user's communities
        const userCommunities = await db.query.communityMembers.findMany({
            where: eq(communityMembers.userId, userId),
        });
        const communityIds = userCommunities.map(c => c.communityId);

        // Get teams belonging to user's communities
        let communityTeamIds: string[] = [];
        if (communityIds.length > 0) {
            const communityTeams = await db.query.teams.findMany({
                where: inArray(teams.communityId, communityIds),
            });
            communityTeamIds = communityTeams.map(t => t.id);
        }

        // Build where clause to include:
        // 1. Games owned by user
        // 2. Games with communityId matching user's communities
        // 3. Games where home or guest team belongs to user's communities
        // 4. Games that are NOT deleted (deletedAt IS NULL)
        let baseWhereClause;
        if (communityIds.length > 0 && communityTeamIds.length > 0) {
            baseWhereClause = or(
                eq(games.ownerId, userId),
                inArray(games.communityId, communityIds),
                inArray(games.homeTeamId, communityTeamIds),
                inArray(games.guestTeamId, communityTeamIds)
            );
        } else if (communityIds.length > 0) {
            baseWhereClause = or(
                eq(games.ownerId, userId),
                inArray(games.communityId, communityIds)
            );
        } else {
            baseWhereClause = eq(games.ownerId, userId);
        }
        
        // Always filter out deleted games
        const whereClause = and(baseWhereClause, isNull(games.deletedAt));

        // Fetch games
        const userGames = await db.query.games.findMany({
            where: whereClause,
            orderBy: [desc(games.createdAt)],
            with: {
                rosters: true,
                community: true,
            }
        });

        // Get unique owner IDs to fetch their names
        const ownerIds = [...new Set(userGames.map(g => g.ownerId))];
        const owners = await db.query.users.findMany({
            where: inArray(users.id, ownerIds),
        });
        const ownerMap = new Map(owners.map(u => [u.id, { 
            firstName: u.firstName, 
            lastName: u.lastName,
            email: u.email 
        }]));

        // Enrich games with owner name
        const gamesWithOwner = userGames.map(game => {
            const owner = ownerMap.get(game.ownerId);
            const ownerName = owner?.firstName && owner?.lastName
                ? `${owner.firstName} ${owner.lastName}`
                : owner?.email || 'Unknown';
            
            return {
                ...game,
                ownerName,
                isOwner: game.ownerId === userId,
            };
        });

        return NextResponse.json(gamesWithOwner);
    } catch (error) {
        console.error('Error fetching games:', error);
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        console.log('Create game body:', JSON.stringify(body, null, 2));
        
        const { homeTeamId, guestTeamId, homeTeamName, guestTeamName, mode, periodSeconds, totalPeriods, totalTimeouts, name, scheduledDate, visibility, communityId } = body;

        // Validate visibility if provided
        const validVisibilities = ['private', 'public_general', 'public_community'];
        const gameVisibility = visibility && validVisibilities.includes(visibility) ? visibility : 'private';

        // Ensure team IDs are proper UUIDs or null (not 'adhoc' string)
        const safeHomeTeamId = homeTeamId && homeTeamId !== 'adhoc' ? homeTeamId : null;
        const safeGuestTeamId = guestTeamId && guestTeamId !== 'adhoc' ? guestTeamId : null;

        const [newGame] = await db.insert(games).values({
            ownerId: userId,
            communityId: communityId || null,
            homeTeamId: safeHomeTeamId,
            guestTeamId: safeGuestTeamId,
            homeTeamName: homeTeamName || 'Home',
            guestTeamName: guestTeamName || 'Guest',
            name: name || null,
            scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
            status: 'scheduled',
            mode: mode || 'simple',
            visibility: gameVisibility as 'private' | 'public_general' | 'public_community',
            periodSeconds: periodSeconds || 600,
            clockSeconds: periodSeconds || 600,
            totalPeriods: totalPeriods || 4,
            totalTimeouts: totalTimeouts || 3,
            homeTimeouts: totalTimeouts || 3,
            guestTimeouts: totalTimeouts || 3,
        }).returning();

        // Populate rosters for both teams if team IDs are provided
        if (homeTeamId && homeTeamId !== 'adhoc') {
            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, homeTeamId),
                with: { athlete: true }
            });

            if (members.length > 0) {
                await db.insert(gameRosters).values(
                    members.map(m => ({
                        gameId: newGame.id,
                        team: 'home' as const,
                        athleteId: m.athleteId,
                        name: m.athlete.name,
                        number: m.number || '00',
                    }))
                );
            }
        }

        if (guestTeamId && guestTeamId !== 'adhoc') {
            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, guestTeamId),
                with: { athlete: true }
            });

            if (members.length > 0) {
                await db.insert(gameRosters).values(
                    members.map(m => ({
                        gameId: newGame.id,
                        team: 'guest' as const,
                        athleteId: m.athleteId,
                        name: m.athlete.name,
                        number: m.number || '00',
                    }))
                );
            }
        }

        // Fetch the complete game with rosters to return
        const completeGame = await db.query.games.findFirst({
            where: eq(games.id, newGame.id),
            with: {
                rosters: true,
            }
        });

        // Log activity
        await logActivity({
            userId,
            action: 'GAME_CREATED',
            resourceType: 'game',
            resourceId: newGame.id,
            details: { home: homeTeamName, guest: guestTeamName }
        });

        return NextResponse.json(completeGame);
    } catch (error) {
        console.error('Error creating game:', error);
        return NextResponse.json({ error: 'Failed to create game', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
