import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const teamEnum = pgEnum('team_side', ['home', 'guest']);
export const eventTypeEnum = pgEnum('event_type', [
    'score', 'foul', 'timeout', 'sub', 'turnover',
    'block', 'steal', 'rebound_off', 'rebound_def',
    'period_start', 'period_end', 'clock_start', 'clock_stop', 'undo', 'miss'
]);
export const gameStatusEnum = pgEnum('game_status', ['scheduled', 'live', 'final']);
export const gameModeEnum = pgEnum('game_mode', ['simple', 'advanced']);
export const gameVisibilityEnum = pgEnum('game_visibility', ['private', 'public_general', 'public_community']);
// scorerRoleEnum is defined lower down

// Community Enums
export const communityTypeEnum = pgEnum('community_type', ['school', 'club', 'league', 'other']);
export const communityRoleEnum = pgEnum('community_role', ['admin', 'scorer', 'viewer']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);

// Season Enums
export const seasonStatusEnum = pgEnum('season_status', ['upcoming', 'active', 'completed', 'archived']);

// Tournament Enums
export const tournamentTypeEnum = pgEnum('tournament_type', [
    'round_robin',
    'double_round_robin',
    'single_elimination',
    'double_elimination',
    'pool_knockout',
    'swiss',
    'group_stage',
    'custom'
]);
export const tournamentStatusEnum = pgEnum('tournament_status', ['scheduled', 'active', 'completed', 'cancelled']);


// --- USER ENTITIES ---

export const themeEnum = pgEnum('theme', ['light', 'dark']);

export const users = pgTable('users', {
    id: text('id').primaryKey(), // Clerk User ID
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
    isWorldAdmin: boolean('is_world_admin').default(false).notNull(), // God-mode access to all communities/data
    theme: themeEnum('theme').default('dark').notNull(), // User's preferred theme: light or dark
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- COMMUNITY ENTITIES ---

export const communities = pgTable('communities', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique(), // URL-friendly identifier for public portals
    type: communityTypeEnum('type').default('other').notNull(),
    ownerId: text('owner_id').notNull(), // Creator
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const communityMembers = pgTable('community_members', {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').notNull(),
    role: communityRoleEnum('role').default('scorer').notNull(),
    canManageGames: boolean('can_manage_games').default(true).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const communityInvites = pgTable('community_invites', {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }).notNull(),
    email: text('email').notNull(),
    role: communityRoleEnum('role').default('scorer').notNull(),
    token: text('token').notNull().unique(),
    status: inviteStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userActivityLogs = pgTable('user_activity_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    details: jsonb('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});


// --- PLAYER INVITATIONS ---

export const playerInvitations = pgTable('player_invitations', {
    id: uuid('id').defaultRandom().primaryKey(),
    athleteId: uuid('athlete_id').references(() => athletes.id, { onDelete: 'cascade' }), // Optional: if inviting existing athlete
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    status: inviteStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdBy: text('created_by').notNull(), // User who sent the invitation
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- PLAYER CLAIM REQUESTS ---

export const playerClaimRequests = pgTable('player_claim_requests', {
    id: uuid('id').defaultRandom().primaryKey(),
    athleteId: uuid('athlete_id').references(() => athletes.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').notNull(), // The user claiming the profile
    status: text('status').default('pending').notNull(), // pending, approved, rejected
    communityId: uuid('community_id').references(() => communities.id), // Community of the athlete (nullable for no-community athletes)
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: text('reviewed_by'), // Admin who approved/rejected
    rejectionReason: text('rejection_reason'),
});


// --- SEASON MANAGEMENT ---

export const seasons = pgTable('seasons', {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: seasonStatusEnum('status').default('upcoming').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teamSeasons = pgTable('team_seasons', {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
    seasonId: uuid('season_id').references(() => seasons.id, { onDelete: 'cascade' }).notNull(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }).notNull(),
    status: text('status').default('active').notNull(), // active, inactive
    createdAt: timestamp('created_at').defaultNow().notNull(),
});


// --- TOURNAMENT MANAGEMENT ---

export const tournaments = pgTable('tournaments', {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }).notNull(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    type: tournamentTypeEnum('type').default('round_robin').notNull(),
    status: tournamentStatusEnum('status').default('scheduled').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tournamentPools = pgTable('tournament_pools', {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    teamsAdvancing: integer('teams_advancing').default(2).notNull(),
});

export const tournamentTeams = pgTable('tournament_teams', {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
    poolId: uuid('pool_id').references(() => tournamentPools.id, { onDelete: 'set null' }),
    seed: integer('seed'),
});

export const tournamentGames = pgTable('tournament_games', {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    poolId: uuid('pool_id').references(() => tournamentPools.id, { onDelete: 'set null' }),
    round: integer('round'),
    bracketPosition: text('bracket_position'), // e.g. "QF1", "SF1", "F"
    isPoolGame: boolean('is_pool_game').default(false).notNull(),
    // Optional statistics for tournament games
    homeFouls: integer('home_fouls'),
    guestFouls: integer('guest_fouls'),
    playerOfTheMatchId: uuid('player_of_the_match_id').references(() => athletes.id, { onDelete: 'set null' }),
    playerOfTheMatchName: text('player_of_the_match_name'), // Free text MVP name
    home3Pointers: integer('home_3_pointers'),
    guest3Pointers: integer('guest_3_pointers'),
    homeFreeThrows: integer('home_free_throws'),
    guestFreeThrows: integer('guest_free_throws'),
});

export const tournamentStandings = pgTable('tournament_standings', {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
    poolId: uuid('pool_id').references(() => tournamentPools.id, { onDelete: 'set null' }),
    wins: integer('wins').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    pointsFor: integer('points_for').default(0).notNull(),
    pointsAgainst: integer('points_against').default(0).notNull(),
    pointDiff: integer('point_diff').default(0).notNull(),
    gamesPlayed: integer('games_played').default(0).notNull(),
});

export const tournamentAwards = pgTable('tournament_awards', {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
    awardType: text('award_type').notNull(), // MVP, Top Scorer, etc.
    athleteId: uuid('athlete_id').references(() => athletes.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    value: text('value'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});


// --- CORE ROSTER ENTITIES ---

export const teams = pgTable('teams', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    communityId: uuid('community_id').references(() => communities.id), // Optional link to community
    name: text('name').notNull(),
    shortCode: text('short_code'), // LAL, BOS
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const athletes = pgTable('athletes', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(), // Who created this profile?
    name: text('name').notNull(), // Computed: firstName + ' ' + surname (kept for backward compat)
    firstName: text('first_name'), // Split from name — required for new players
    surname: text('surname'), // Split from name — required for new players
    email: text('email'), // Optional email for lookup
    birthDate: date('birth_date'), // Optional birth date for age verification / search disambiguation
    status: text('status').default('active').notNull(), // active, inactive, transferred, merged
    isWorldAvailable: boolean('is_world_available').default(false).notNull(), // Visible to all communities in search
    communityId: uuid('community_id').references(() => communities.id), // Community this player belongs to
    mergedIntoId: uuid('merged_into_id'), // If merged, references the primary athlete profile
    userId: text('user_id'), // Link to registered user (for players who have claimed their profile)
    invitedBy: text('invited_by'), // User who invited this player
    invitedAt: timestamp('invited_at'), // When the player was invited
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const playerHistory = pgTable('player_history', {
    id: uuid('id').defaultRandom().primaryKey(),
    athleteId: uuid('athlete_id').references(() => athletes.id, { onDelete: 'cascade' }).notNull(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
    action: text('action').notNull(), // added, removed, number_changed, transferred
    previousValue: text('previous_value'), // Previous jersey number
    newValue: text('new_value'), // New jersey number
    performedBy: text('performed_by'), // User who made change
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamMemberships = pgTable('team_memberships', {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
    athleteId: uuid('athlete_id').references(() => athletes.id, { onDelete: 'cascade' }).notNull(),
    number: text('number'), // Jersey number in this team context
    startDate: date('start_date').defaultNow().notNull(),
    endDate: date('end_date'), // NULL = Active
    isActive: boolean('is_active').default(true).notNull(),
    communityId: uuid('community_id'), // Community context for this membership
    createdBy: text('created_by'), // User who added player to team
    notes: text('notes'), // Optional roster notes
});

// --- GAME ENTITIES ---

export const games = pgTable('games', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    communityId: uuid('community_id').references(() => communities.id), // Optional link to community
    seasonId: uuid('season_id').references(() => seasons.id), // Optional link to season

    // Optional user-defined game name and date
    name: text('name'),
    scheduledDate: timestamp('scheduled_date'),

    // Public visibility settings
    visibility: gameVisibilityEnum('visibility').default('private').notNull(),

    // Teams (FKs) - Nullable for ad-hoc/guest teams that aren't in the system
    homeTeamId: uuid('home_team_id').references(() => teams.id),
    guestTeamId: uuid('guest_team_id').references(() => teams.id),

    // Fallback names if Team entity doesn't exist
    homeTeamName: text('home_team_name').notNull(),
    guestTeamName: text('guest_team_name').notNull(),

    status: gameStatusEnum('status').default('scheduled').notNull(),

    currentPeriod: integer('current_period').default(1).notNull(),
    totalPeriods: integer('total_periods').default(4).notNull(),
    periodSeconds: integer('period_seconds').default(600).notNull(),
    clockSeconds: integer('clock_seconds').default(600).notNull(),
    homeScore: integer('home_score').default(0).notNull(),
    guestScore: integer('guest_score').default(0).notNull(),
    homeFouls: integer('home_fouls').default(0).notNull(),
    guestFouls: integer('guest_fouls').default(0).notNull(),
    homeTimeouts: integer('home_timeouts').default(3).notNull(),
    guestTimeouts: integer('guest_timeouts').default(3).notNull(),
    totalTimeouts: integer('total_timeouts').default(3).notNull(),
    possession: teamEnum('possession'),
    mode: gameModeEnum('mode').default('simple').notNull(),
    isTimerRunning: boolean('is_timer_running').default(false).notNull(),
    timerStartedAt: timestamp('timer_started_at'), // When timer was last started (for accurate elapsed time calc)
    timerOffsetSeconds: integer('timer_offset_seconds').default(0), // Accumulated time when timer was stopped

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // Soft delete - null means not deleted
});

// Replaces old 'players' table
export const gameRosters = pgTable('game_rosters', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    team: teamEnum('team').notNull(), // Home or Guest side

    athleteId: uuid('athlete_id').references(() => athletes.id), // Link to global profile if exists

    name: text('name').notNull(), // Copied for history or ad-hoc
    number: text('number').notNull(),
    isActive: boolean('is_active').default(false).notNull(),

    // Game Stats
    points: integer('points').default(0).notNull(),
    fouls: integer('fouls').default(0).notNull(),
});

export const gameEvents = pgTable('game_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    type: eventTypeEnum('type').notNull(),

    period: integer('period').notNull(),
    clockAt: integer('clock_at').notNull(),
    team: teamEnum('team'),
    player: text('player'), // Denormalized name for easier display/history

    // References gameRoster record, NOT athlete directly (to handle ad-hoc players)
    gameRosterId: uuid('game_roster_id').references(() => gameRosters.id),

    value: integer('value'),
    metadata: jsonb('metadata'),
    description: text('description').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Multi-scorer support - tracks authorized scorers for a game
export const scorerRoleEnum = pgEnum('scorer_role', ['owner', 'co_scorer', 'viewer']);

export const gameScorers = pgTable('game_scorers', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').notNull(), // Clerk user ID
    role: scorerRoleEnum('role').default('co_scorer').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
});

// Scorer invite tokens — allows inviting by email or shareable link
export const scorerInviteStatusEnum = pgEnum('scorer_invite_status', ['pending', 'accepted', 'expired']);

export const gameScorerInvites = pgTable('game_scorer_invites', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    email: text('email'), // null = link-only invite (no specific recipient)
    token: text('token').notNull().unique(),
    status: scorerInviteStatusEnum('status').default('pending').notNull(),
    role: scorerRoleEnum('role').default('co_scorer').notNull(),
    createdBy: text('created_by').notNull(), // Clerk userId of inviter
    acceptedBy: text('accepted_by'),          // Clerk userId of accepter
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    memberships: many(communityMembers),
    logs: many(userActivityLogs),
    ownedCommunities: many(communities),
    ownedTeams: many(teams),
    ownedGames: many(games),
    communityMemberships: many(communityMembers),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
    owner: one(users, { fields: [communities.ownerId], references: [users.id] }),
    members: many(communityMembers),
    invites: many(communityInvites),
    teams: many(teams),
    games: many(games),
    logs: many(userActivityLogs),
    seasons: many(seasons),
    tournaments: many(tournaments),
}));

export const communityMembersRelations = relations(communityMembers, ({ one }) => ({
    community: one(communities, { fields: [communityMembers.communityId], references: [communities.id] }),
    user: one(users, { fields: [communityMembers.userId], references: [users.id] }),
}));

export const communityInvitesRelations = relations(communityInvites, ({ one }) => ({
    community: one(communities, { fields: [communityInvites.communityId], references: [communities.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
    community: one(communities, { fields: [teams.communityId], references: [communities.id] }),
    memberships: many(teamMemberships),
    homeGames: many(games, { relationName: 'homeGames' }),
    guestGames: many(games, { relationName: 'guestGames' }),
    teamSeasons: many(teamSeasons),
    tournamentParticipations: many(tournamentTeams),
    tournamentStandings: many(tournamentStandings),
    tournamentAwards: many(tournamentAwards),
}));

export const athletesRelations = relations(athletes, ({ one, many }) => ({
    community: one(communities, { fields: [athletes.communityId], references: [communities.id] }),
    user: one(users, { fields: [athletes.userId], references: [users.id] }),
    memberships: many(teamMemberships),
    gameAppearances: many(gameRosters),
    invitations: many(playerInvitations),
    tournamentAwards: many(tournamentAwards),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
    team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
    athlete: one(athletes, { fields: [teamMemberships.athleteId], references: [athletes.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
    community: one(communities, { fields: [games.communityId], references: [communities.id] }),
    season: one(seasons, { fields: [games.seasonId], references: [seasons.id] }),
    homeTeam: one(teams, { fields: [games.homeTeamId], references: [teams.id], relationName: 'homeGames' }),
    guestTeam: one(teams, { fields: [games.guestTeamId], references: [teams.id], relationName: 'guestGames' }),
    rosters: many(gameRosters),
    events: many(gameEvents),
    scorers: many(gameScorers),
    invites: many(gameScorerInvites),
    tournamentGame: one(tournamentGames),
}));

export const gameScorersRelations = relations(gameScorers, ({ one }) => ({
    game: one(games, { fields: [gameScorers.gameId], references: [games.id] }),
}));

export const gameScorerInvitesRelations = relations(gameScorerInvites, ({ one }) => ({
    game: one(games, { fields: [gameScorerInvites.gameId], references: [games.id] }),
}));

export const gameRostersRelations = relations(gameRosters, ({ one, many }) => ({
    game: one(games, { fields: [gameRosters.gameId], references: [games.id] }),
    athlete: one(athletes, { fields: [gameRosters.athleteId], references: [athletes.id] }),
    events: many(gameEvents, { relationName: 'playerEvents' }), // Inverse relation if needed
}));

export const gameEventsRelations = relations(gameEvents, ({ one }) => ({
    game: one(games, { fields: [gameEvents.gameId], references: [games.id] }),
    rosterEntry: one(gameRosters, { fields: [gameEvents.gameRosterId], references: [gameRosters.id] }),
}));

export const playerHistoryRelations = relations(playerHistory, ({ one }) => ({
    athlete: one(athletes, { fields: [playerHistory.athleteId], references: [athletes.id] }),
    team: one(teams, { fields: [playerHistory.teamId], references: [teams.id] }),
}));

export const playerInvitationsRelations = relations(playerInvitations, ({ one }) => ({
    athlete: one(athletes, { fields: [playerInvitations.athleteId], references: [athletes.id] }),
}));

export const playerClaimRequestsRelations = relations(playerClaimRequests, ({ one }) => ({
    athlete: one(athletes, { fields: [playerClaimRequests.athleteId], references: [athletes.id] }),
    community: one(communities, { fields: [playerClaimRequests.communityId], references: [communities.id] }),
    reviewer: one(users, { fields: [playerClaimRequests.reviewedBy], references: [users.id] }),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
    community: one(communities, { fields: [seasons.communityId], references: [communities.id] }),
    teamSeasons: many(teamSeasons),
    games: many(games),
}));

export const teamSeasonsRelations = relations(teamSeasons, ({ one }) => ({
    team: one(teams, { fields: [teamSeasons.teamId], references: [teams.id] }),
    season: one(seasons, { fields: [teamSeasons.seasonId], references: [seasons.id] }),
    community: one(communities, { fields: [teamSeasons.communityId], references: [communities.id] }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
    community: one(communities, { fields: [tournaments.communityId], references: [communities.id] }),
    owner: one(users, { fields: [tournaments.ownerId], references: [users.id] }),
    pools: many(tournamentPools),
    teams: many(tournamentTeams),
    games: many(tournamentGames),
    standings: many(tournamentStandings),
    awards: many(tournamentAwards),
}));

export const tournamentPoolsRelations = relations(tournamentPools, ({ one, many }) => ({
    tournament: one(tournaments, { fields: [tournamentPools.tournamentId], references: [tournaments.id] }),
    teams: many(tournamentTeams),
    games: many(tournamentGames),
    standings: many(tournamentStandings),
}));

export const tournamentTeamsRelations = relations(tournamentTeams, ({ one }) => ({
    tournament: one(tournaments, { fields: [tournamentTeams.tournamentId], references: [tournaments.id] }),
    team: one(teams, { fields: [tournamentTeams.teamId], references: [teams.id] }),
    pool: one(tournamentPools, { fields: [tournamentTeams.poolId], references: [tournamentPools.id] }),
}));

export const tournamentGamesRelations = relations(tournamentGames, ({ one }) => ({
    tournament: one(tournaments, { fields: [tournamentGames.tournamentId], references: [tournaments.id] }),
    game: one(games, { fields: [tournamentGames.gameId], references: [games.id] }),
    pool: one(tournamentPools, { fields: [tournamentGames.poolId], references: [tournamentPools.id] }),
    playerOfTheMatch: one(athletes, { fields: [tournamentGames.playerOfTheMatchId], references: [athletes.id] }),
}));

export const tournamentStandingsRelations = relations(tournamentStandings, ({ one }) => ({
    tournament: one(tournaments, { fields: [tournamentStandings.tournamentId], references: [tournaments.id] }),
    team: one(teams, { fields: [tournamentStandings.teamId], references: [teams.id] }),
    pool: one(tournamentPools, { fields: [tournamentStandings.poolId], references: [tournamentPools.id] }),
}));

export const tournamentAwardsRelations = relations(tournamentAwards, ({ one }) => ({
    tournament: one(tournaments, { fields: [tournamentAwards.tournamentId], references: [tournaments.id] }),
    athlete: one(athletes, { fields: [tournamentAwards.athleteId], references: [athletes.id] }),
    team: one(teams, { fields: [tournamentAwards.teamId], references: [teams.id] }),
}));

// --- HASURA REAL-TIME SYNC TABLES ---
// These tables are specifically for Hasura GraphQL subscriptions and real-time game state synchronization

export const gameStates = pgTable('game_states', {
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).primaryKey().notNull(),
    homeScore: integer('home_score').default(0).notNull(),
    guestScore: integer('guest_score').default(0).notNull(),
    homeFouls: integer('home_fouls').default(0).notNull(),
    guestFouls: integer('guest_fouls').default(0).notNull(),
    homeTimeouts: integer('home_timeouts').default(3).notNull(),
    guestTimeouts: integer('guest_timeouts').default(3).notNull(),
    clockSeconds: integer('clock_seconds').default(600).notNull(),
    isTimerRunning: boolean('is_timer_running').default(false).notNull(),
    currentPeriod: integer('current_period').default(1).notNull(),
    possession: text('possession'), // 'home' or 'guest'
    status: text('status').default('scheduled').notNull(), // 'scheduled', 'live', 'final'
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text('updated_by'),
});

export const hasuraGameEvents = pgTable('hasura_game_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    eventId: text('event_id'), // Client-generated event ID for deduplication
    type: text('type').notNull(),
    period: integer('period').notNull(),
    clockAt: integer('clock_at').notNull(),
    team: text('team'), // 'home' or 'guest'
    player: text('player'),
    value: integer('value'),
    metadata: jsonb('metadata'),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
});

export const timerSync = pgTable('timer_sync', {
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).primaryKey().notNull(),
    isRunning: boolean('is_running').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    initialClockSeconds: integer('initial_clock_seconds').notNull(),
    currentClockSeconds: integer('current_clock_seconds').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text('updated_by'),
});

// --- HASURA SYNC TABLE RELATIONS ---

export const gameStatesRelations = relations(gameStates, ({ one }) => ({
    game: one(games, { fields: [gameStates.gameId], references: [games.id] }),
}));

export const hasuraGameEventsRelations = relations(hasuraGameEvents, ({ one }) => ({
    game: one(games, { fields: [hasuraGameEvents.gameId], references: [games.id] }),
}));

export const timerSyncRelations = relations(timerSync, ({ one }) => ({
    game: one(games, { fields: [timerSync.gameId], references: [games.id] }),
}));
