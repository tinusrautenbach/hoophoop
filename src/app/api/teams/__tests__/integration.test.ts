import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { teams, athletes, teamMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Teams and Members API Integration Tests', () => {
    let testTeamId: string;
    let testAthleteId: string;
    let testMembershipId: string;
    const testUserId = 'user_mock_123';

    beforeAll(async () => {
        // Clean up any existing test data by name
        const existingTeam = await db.query.teams.findFirst({
            where: eq(teams.name, 'Test Team Integration'),
        });
        if (existingTeam) {
            await db.delete(teamMemberships).where(eq(teamMemberships.teamId, existingTeam.id));
            await db.delete(teams).where(eq(teams.id, existingTeam.id));
        }
    });

    afterAll(async () => {
        // Clean up test data
        if (testMembershipId) {
            await db.delete(teamMemberships).where(eq(teamMemberships.id, testMembershipId));
        }
        if (testAthleteId) {
            await db.delete(athletes).where(eq(athletes.id, testAthleteId));
        }
        if (testTeamId) {
            await db.delete(teams).where(eq(teams.id, testTeamId));
        }
    });

    describe('Database Operations', () => {
        it('should create a team', async () => {
            const [team] = await db.insert(teams).values({
                ownerId: testUserId,
                name: 'Test Team Integration',
                shortCode: 'TTI',
            }).returning();

            expect(team).toBeDefined();
            expect(team.name).toBe('Test Team Integration');
            testTeamId = team.id;
        });

        it('should create an athlete', async () => {
            const [athlete] = await db.insert(athletes).values({
                ownerId: testUserId,
                name: 'Test Player',
                firstName: 'Test',
                surname: 'Player',
            }).returning();

            expect(athlete).toBeDefined();
            expect(athlete.name).toBe('Test Player');
            testAthleteId = athlete.id;
        });

        it('should create a team membership', async () => {
            const [membership] = await db.insert(teamMemberships).values({
                teamId: testTeamId,
                athleteId: testAthleteId,
                number: '99',
            }).returning();

            expect(membership).toBeDefined();
            expect(membership.number).toBe('99');
            testMembershipId = membership.id;
        });

        it('should query team members with athlete details', async () => {
            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, testTeamId),
                with: {
                    athlete: true,
                },
            });

            expect(members).toBeDefined();
            expect(members.length).toBeGreaterThan(0);
            expect(members[0].athlete).toBeDefined();
            expect(members[0].athlete.name).toBe('Test Player');
        });

        it('should delete a team membership', async () => {
            await db.delete(teamMemberships).where(eq(teamMemberships.id, testMembershipId));

            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, testTeamId),
            });

            expect(members.length).toBe(0);
        });
    });

    describe('API Endpoints', () => {
        let apiTestTeamId: string;

        beforeAll(async () => {
            // Create a test team for API tests
            const [team] = await db.insert(teams).values({
                ownerId: testUserId,
                name: 'API Test Team',
                shortCode: 'ATT',
            }).returning();
            apiTestTeamId = team.id;
        });

        afterAll(async () => {
            // Clean up
            await db.delete(teamMemberships).where(eq(teamMemberships.teamId, apiTestTeamId));
            await db.delete(teams).where(eq(teams.id, apiTestTeamId));
        });

        it('should fetch team members via API', async () => {
            const response = await fetch(`http://localhost:3030/api/teams/${apiTestTeamId}/members`, {
                headers: { 'x-test-auth': 'true' }
            });
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should add a member via API', async () => {
            const response = await fetch(`http://localhost:3030/api/teams/${apiTestTeamId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-test-auth': 'true'
                },
                body: JSON.stringify({ name: 'API Test Player', number: '88' }),
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.athlete.name).toBe('API Test Player');
            expect(data.number).toBe('88');
        });

        it('should fetch members after adding', async () => {
            const response = await fetch(`http://localhost:3030/api/teams/${apiTestTeamId}/members`, {
                headers: { 'x-test-auth': 'true' }
            });
            const data = await response.json();

            expect(data.length).toBeGreaterThan(0);
            expect(data[0].athlete.name).toBe('API Test Player');
        });
    });
});
