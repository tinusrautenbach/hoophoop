import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/db';
import { teams, athletes, teamMemberships, games, gameRosters } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Comprehensive API Test Suite for Teams, Athletes, Rosters, and Games
 * 
 * This test suite covers:
 * - Teams CRUD operations
 * - Athletes CRUD operations
 * - Team Memberships (Rosters) CRUD operations
 * - Games CRUD operations
 * - Game Rosters operations
 * - Complex queries with relations
 */

describe('Complete Basketball App API Test Suite', () => {
    const testUserId = 'user_mock_123';
    let testTeamId: string;
    let testTeam2Id: string;
    const testAthleteIds: string[] = [];
    let testMembershipIds: string[] = [];
    let testGameId: string;

    beforeAll(async () => {
        // Clean up any existing test data
        const existingTeam = await db.query.teams.findFirst({
            where: eq(teams.name, 'API Test Team 1'),
        });
        if (existingTeam) {
            await db.delete(teamMemberships).where(eq(teamMemberships.teamId, existingTeam.id));
            await db.delete(teams).where(eq(teams.id, existingTeam.id));
        }
    });

    afterAll(async () => {
        // Cleanup all test data
        if (testGameId) {
            await db.delete(gameRosters).where(eq(gameRosters.gameId, testGameId));
            await db.delete(games).where(eq(games.id, testGameId));
        }
        if (testMembershipIds.length > 0) {
            for (const id of testMembershipIds) {
                await db.delete(teamMemberships).where(eq(teamMemberships.id, id));
            }
        }
        if (testAthleteIds.length > 0) {
            for (const id of testAthleteIds) {
                await db.delete(athletes).where(eq(athletes.id, id));
            }
        }
        if (testTeamId) {
            await db.delete(teams).where(eq(teams.id, testTeamId));
        }
        if (testTeam2Id) {
            await db.delete(teams).where(eq(teams.id, testTeam2Id));
        }
    });

    describe('Teams API', () => {
        it('should create a team', async () => {
            const [team] = await db.insert(teams).values({
                ownerId: testUserId,
                name: 'API Test Team 1',
                shortCode: 'ATT1',
                color: '#FF5733',
            }).returning();

            expect(team).toBeDefined();
            expect(team.name).toBe('API Test Team 1');
            expect(team.shortCode).toBe('ATT1');
            expect(team.color).toBe('#FF5733');
            expect(team.ownerId).toBe(testUserId);
            testTeamId = team.id;
        });

        it('should create a second team', async () => {
            const [team] = await db.insert(teams).values({
                ownerId: testUserId,
                name: 'API Test Team 2',
                shortCode: 'ATT2',
            }).returning();

            expect(team).toBeDefined();
            expect(team.name).toBe('API Test Team 2');
            testTeam2Id = team.id;
        });

        it('should fetch all teams for a user', async () => {
            const userTeams = await db.query.teams.findMany({
                where: eq(teams.ownerId, testUserId),
            });

            expect(userTeams.length).toBeGreaterThanOrEqual(2);
            const testTeams = userTeams.filter(t =>
                t.name === 'API Test Team 1' || t.name === 'API Test Team 2'
            );
            expect(testTeams.length).toBe(2);
        });

        it('should fetch a single team by ID', async () => {
            const team = await db.query.teams.findFirst({
                where: eq(teams.id, testTeamId),
            });

            expect(team).toBeDefined();
            expect(team?.name).toBe('API Test Team 1');
        });

        it('should update a team', async () => {
            const [updated] = await db.update(teams)
                .set({ color: '#00FF00' })
                .where(eq(teams.id, testTeamId))
                .returning();

            expect(updated.color).toBe('#00FF00');
        });
    });

    describe('Athletes API', () => {
        it('should create multiple athletes', async () => {
            const athleteData = [
                { name: 'Test Player 1', firstName: 'Test', surname: 'Player 1' },
                { name: 'Test Player 2', firstName: 'Test', surname: 'Player 2' },
                { name: 'Test Player 3', firstName: 'Test', surname: 'Player 3' },
                { name: 'Test Player 4', firstName: 'Test', surname: 'Player 4' },
                { name: 'Test Player 5', firstName: 'Test', surname: 'Player 5' },
            ];

            for (const data of athleteData) {
                const [athlete] = await db.insert(athletes).values({
                    ownerId: testUserId,
                    name: data.name,
                    firstName: data.firstName,
                    surname: data.surname,
                }).returning();

                expect(athlete).toBeDefined();
                expect(athlete.name).toBe(data.name);
                testAthleteIds.push(athlete.id);
            }

            expect(testAthleteIds.length).toBe(5);
        });

        it('should fetch all athletes for a user', async () => {
            const userAthletes = await db.query.athletes.findMany({
                where: eq(athletes.ownerId, testUserId),
            });

            expect(userAthletes.length).toBeGreaterThanOrEqual(5);
        });

        it('should fetch a single athlete by ID', async () => {
            const athlete = await db.query.athletes.findFirst({
                where: eq(athletes.id, testAthleteIds[0]),
            });

            expect(athlete).toBeDefined();
            expect(athlete?.name).toBe('Test Player 1');
        });
    });

    describe('Team Memberships (Rosters) API', () => {
        it('should add athletes to team roster', async () => {
            const membershipData = [
                { athleteId: testAthleteIds[0], number: '23' },
                { athleteId: testAthleteIds[1], number: '11' },
                { athleteId: testAthleteIds[2], number: '7' },
            ];

            for (const data of membershipData) {
                const [membership] = await db.insert(teamMemberships).values({
                    teamId: testTeamId,
                    athleteId: data.athleteId,
                    number: data.number,
                }).returning();

                expect(membership).toBeDefined();
                expect(membership.number).toBe(data.number);
                testMembershipIds.push(membership.id);
            }

            expect(testMembershipIds.length).toBe(3);
        });

        it('should fetch team roster with athlete details', async () => {
            const roster = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, testTeamId),
                with: {
                    athlete: true,
                },
            });

            expect(roster.length).toBe(3);
            expect(roster[0].athlete).toBeDefined();
            expect(roster[0].athlete.name).toBeTruthy();
        });

        it('should update a team membership', async () => {
            const [updated] = await db.update(teamMemberships)
                .set({ number: '99' })
                .where(eq(teamMemberships.id, testMembershipIds[0]))
                .returning();

            expect(updated.number).toBe('99');
        });

        it('should remove an athlete from roster', async () => {
            await db.delete(teamMemberships)
                .where(eq(teamMemberships.id, testMembershipIds[2]));

            const roster = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, testTeamId),
            });

            expect(roster.length).toBe(2);
            testMembershipIds = testMembershipIds.slice(0, 2);
        });
    });

    describe('Games API', () => {
        it('should create a game', async () => {
            const [game] = await db.insert(games).values({
                ownerId: testUserId,
                homeTeamId: testTeamId,
                guestTeamId: testTeam2Id,
                homeTeamName: 'API Test Team 1',
                guestTeamName: 'API Test Team 2',
                mode: 'simple',
                status: 'scheduled',
                totalPeriods: 4,
                periodSeconds: 600,
                currentPeriod: 1,
                clockSeconds: 600,
                homeScore: 0,
                guestScore: 0,
                homeFouls: 0,
                guestFouls: 0,
            }).returning();

            expect(game).toBeDefined();
            expect(game.homeTeamName).toBe('API Test Team 1');
            expect(game.guestTeamName).toBe('API Test Team 2');
            expect(game.status).toBe('scheduled');
            testGameId = game.id;
        });

        it('should fetch a game by ID', async () => {
            const game = await db.query.games.findFirst({
                where: eq(games.id, testGameId),
            });

            expect(game).toBeDefined();
            expect(game?.homeTeamName).toBe('API Test Team 1');
        });

        it('should update game status', async () => {
            const [updated] = await db.update(games)
                .set({ status: 'live' })
                .where(eq(games.id, testGameId))
                .returning();

            expect(updated.status).toBe('live');
        });

        it('should update game score', async () => {
            const [updated] = await db.update(games)
                .set({
                    homeScore: 25,
                    guestScore: 22,
                })
                .where(eq(games.id, testGameId))
                .returning();

            expect(updated.homeScore).toBe(25);
            expect(updated.guestScore).toBe(22);
        });

        it('should fetch all games for a user', async () => {
            const userGames = await db.query.games.findMany({
                where: eq(games.ownerId, testUserId),
            });

            expect(userGames.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Game Rosters API', () => {
        it('should populate game roster from team roster', async () => {
            const teamRoster = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, testTeamId),
                with: {
                    athlete: true,
                },
            });

            const rosterEntries = teamRoster.map(m => ({
                gameId: testGameId,
                team: 'home' as const,
                athleteId: m.athleteId,
                name: m.athlete.name,
                number: m.number || '00',
                points: 0,
                fouls: 0,
                isActive: true,
            }));

            await db.insert(gameRosters).values(rosterEntries);

            const gameRoster = await db.query.gameRosters.findMany({
                where: eq(gameRosters.gameId, testGameId),
            });

            expect(gameRoster.length).toBe(teamRoster.length);
        });

        it('should fetch game with rosters', async () => {
            const game = await db.query.games.findFirst({
                where: eq(games.id, testGameId),
                with: {
                    rosters: true,
                },
            });

            expect(game).toBeDefined();
            expect(game?.rosters).toBeDefined();
            expect(game?.rosters.length).toBeGreaterThan(0);
        });

        it('should update player stats in game roster', async () => {
            const gameRoster = await db.query.gameRosters.findMany({
                where: eq(gameRosters.gameId, testGameId),
            });

            const [updated] = await db.update(gameRosters)
                .set({
                    points: 15,
                    fouls: 2,
                })
                .where(eq(gameRosters.id, gameRoster[0].id))
                .returning();

            expect(updated.points).toBe(15);
            expect(updated.fouls).toBe(2);
        });

        it('should filter active players in game roster', async () => {
            const activePlayers = await db.query.gameRosters.findMany({
                where: eq(gameRosters.gameId, testGameId),
            });

            const activeCount = activePlayers.filter(p => p.isActive).length;
            expect(activeCount).toBeGreaterThan(0);
        });
    });

    describe('Complex Queries', () => {
        it('should fetch team with all members and their stats', async () => {
            const team = await db.query.teams.findFirst({
                where: eq(teams.id, testTeamId),
                with: {
                    memberships: {
                        with: {
                            athlete: true,
                        },
                    },
                },
            });

            expect(team).toBeDefined();
            expect(team?.memberships).toBeDefined();
            expect(team?.memberships.length).toBeGreaterThan(0);
            expect(team?.memberships[0].athlete).toBeDefined();
        });

        it('should fetch game with full roster details', async () => {
            const game = await db.query.games.findFirst({
                where: eq(games.id, testGameId),
                with: {
                    rosters: true,
                },
            });

            expect(game).toBeDefined();
            expect(game?.rosters).toBeDefined();

            const homeRoster = game?.rosters.filter(r => r.team === 'home');
            expect(homeRoster?.length).toBeGreaterThan(0);
        });

        it('should calculate total points from game roster', async () => {
            const gameRoster = await db.query.gameRosters.findMany({
                where: eq(gameRosters.gameId, testGameId),
            });

            const totalPoints = gameRoster.reduce((sum, player) => sum + player.points, 0);
            expect(totalPoints).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge Cases and Validation', () => {
        it('should handle empty rosters', async () => {
            const emptyTeam = await db.query.teams.findFirst({
                where: eq(teams.id, testTeam2Id),
                with: {
                    memberships: true,
                },
            });

            expect(emptyTeam).toBeDefined();
            expect(emptyTeam?.memberships).toBeDefined();
            expect(Array.isArray(emptyTeam?.memberships)).toBe(true);
        });

        it('should handle games without rosters', async () => {
            const [gameWithoutRoster] = await db.insert(games).values({
                ownerId: testUserId,
                homeTeamName: 'Quick Game Home',
                guestTeamName: 'Quick Game Guest',
                mode: 'simple',
                status: 'scheduled',
                totalPeriods: 4,
                periodSeconds: 600,
                currentPeriod: 1,
                clockSeconds: 600,
                homeScore: 0,
                guestScore: 0,
            }).returning();

            const game = await db.query.games.findFirst({
                where: eq(games.id, gameWithoutRoster.id),
                with: {
                    rosters: true,
                },
            });

            expect(game).toBeDefined();
            expect(game?.rosters.length).toBe(0);

            // Cleanup
            await db.delete(games).where(eq(games.id, gameWithoutRoster.id));
        });

        it('should handle athlete without team memberships', async () => {
            const [freeAgent] = await db.insert(athletes).values({
                ownerId: testUserId,
                name: 'Free Agent',
                firstName: 'Free',
                surname: 'Agent',
            }).returning();

            const memberships = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.athleteId, freeAgent.id),
            });

            expect(memberships.length).toBe(0);

            // Cleanup
            await db.delete(athletes).where(eq(athletes.id, freeAgent.id));
        });
    });
});
