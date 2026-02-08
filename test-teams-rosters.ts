#!/usr/bin/env tsx

/**
 * Comprehensive Test Suite for Teams and Roster Management
 * This script tests the database layer directly to verify all functionality works
 */

import { db } from './src/db/index.js';
import { teams, athletes, teamMemberships, games, gameRosters } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const testUserId = 'user_mock_123';
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`✓ ${message}`);
        testsPassed++;
    } else {
        console.error(`✗ ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n=== COMPREHENSIVE TEAMS & ROSTER TEST SUITE ===\n');

    // Test 1: Create a team
    console.log('Test 1: Creating a team...');
    const [team] = await db.insert(teams).values({
        ownerId: testUserId,
        name: 'Test Warriors',
        shortCode: 'TWR',
    }).returning();
    assert(!!team && team.name === 'Test Warriors', 'Team created successfully');

    // Test 2: Create athletes
    console.log('\nTest 2: Creating athletes...');
    const athleteData = [
        { name: 'Stephen Curry', number: '30' },
        { name: 'Klay Thompson', number: '11' },
        { name: 'Draymond Green', number: '23' },
    ];

    const createdAthletes = [];
    for (const athlete of athleteData) {
        const [newAthlete] = await db.insert(athletes).values({
            ownerId: testUserId,
            name: athlete.name,
        }).returning();
        createdAthletes.push({ ...newAthlete, number: athlete.number });
    }
    assert(createdAthletes.length === 3, `Created ${createdAthletes.length} athletes`);

    // Test 3: Create team memberships
    console.log('\nTest 3: Creating team memberships...');
    const memberships = [];
    for (const athlete of createdAthletes) {
        const [membership] = await db.insert(teamMemberships).values({
            teamId: team.id,
            athleteId: athlete.id,
            number: athlete.number,
        }).returning();
        memberships.push(membership);
    }
    assert(memberships.length === 3, `Created ${memberships.length} team memberships`);

    // Test 4: Query team members with athlete details
    console.log('\nTest 4: Querying team members with athlete details...');
    const members = await db.query.teamMemberships.findMany({
        where: eq(teamMemberships.teamId, team.id),
        with: {
            athlete: true,
        },
    });
    assert(members.length === 3, `Found ${members.length} team members`);
    assert(members[0].athlete !== undefined, 'Athlete details included in query');
    assert(members[0].athlete.name === 'Stephen Curry', 'First athlete is Stephen Curry');

    // Test 5: Create a game
    console.log('\nTest 5: Creating a game...');
    const [game] = await db.insert(games).values({
        ownerId: testUserId,
        homeTeamId: team.id,
        homeTeamName: team.name,
        guestTeamName: 'Opponent Team',
        mode: 'simple',
        status: 'scheduled',
        totalPeriods: 4,
        periodSeconds: 600,
        currentPeriod: 1,
        clockSeconds: 600,
        homeScore: 0,
        guestScore: 0,
    }).returning();
    assert(!!game && game.homeTeamName === 'Test Warriors', 'Game created successfully');

    // Test 6: Populate game roster from team
    console.log('\nTest 6: Populating game roster from team...');
    const rosterEntries = members.map(m => ({
        gameId: game.id,
        team: 'home' as const,
        athleteId: m.athleteId,
        name: m.athlete.name,
        number: m.number || '00',
    }));

    await db.insert(gameRosters).values(rosterEntries);

    const gameRosterCheck = await db.query.gameRosters.findMany({
        where: eq(gameRosters.gameId, game.id),
    });
    assert(gameRosterCheck.length === 3, `Game roster has ${gameRosterCheck.length} players`);

    // Test 7: Fetch game with rosters
    console.log('\nTest 7: Fetching game with rosters...');
    const gameWithRosters = await db.query.games.findFirst({
        where: eq(games.id, game.id),
        with: {
            rosters: true,
        },
    });
    assert(!!gameWithRosters, 'Game fetched successfully');
    assert(!!gameWithRosters && gameWithRosters.rosters.length === 3, `Game has ${gameWithRosters?.rosters.length || 0} roster entries`);

    // Test 8: Delete a team member
    console.log('\nTest 8: Deleting a team member...');
    await db.delete(teamMemberships).where(eq(teamMemberships.id, memberships[0].id));
    const remainingMembers = await db.query.teamMemberships.findMany({
        where: eq(teamMemberships.teamId, team.id),
    });
    assert(remainingMembers.length === 2, `${remainingMembers.length} members remaining after deletion`);

    // Cleanup
    console.log('\nCleaning up test data...');
    await db.delete(gameRosters).where(eq(gameRosters.gameId, game.id));
    await db.delete(games).where(eq(games.id, game.id));
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, team.id));
    for (const athlete of createdAthletes) {
        await db.delete(athletes).where(eq(athletes.id, athlete.id));
    }
    await db.delete(teams).where(eq(teams.id, team.id));
    console.log('✓ Cleanup complete');

    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

runTests().catch((error) => {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
});
