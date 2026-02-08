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
// scorerRoleEnum is defined lower down

// Community Enums
export const communityTypeEnum = pgEnum('community_type', ['school', 'club', 'league', 'other']);
export const communityRoleEnum = pgEnum('community_role', ['admin', 'scorer', 'viewer']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);


// --- USER ENTITIES ---

export const users = pgTable('users', {
    id: text('id').primaryKey(), // Clerk User ID
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- COMMUNITY ENTITIES ---

export const communities = pgTable('communities', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
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
    name: text('name').notNull(),
    email: text('email'), // Optional email for lookup
    birthDate: date('birth_date'), // Optional birth date for age verification
    status: text('status').default('active').notNull(), // active, inactive, transferred
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

    // Optional user-defined game name and date
    name: text('name'), 
    scheduledDate: timestamp('scheduled_date'),

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

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    memberships: many(communityMembers),
    logs: many(userActivityLogs),
    ownedCommunities: many(communities),
    ownedTeams: many(teams),
    ownedGames: many(games),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
    owner: one(users, { fields: [communities.ownerId], references: [users.id] }),
    members: many(communityMembers),
    invites: many(communityInvites),
    teams: many(teams),
    games: many(games),
    logs: many(userActivityLogs),
}));

export const communityMembersRelations = relations(communityMembers, ({ one }) => ({
    community: one(communities, { fields: [communityMembers.communityId], references: [communities.id] }),
}));

export const communityInvitesRelations = relations(communityInvites, ({ one }) => ({
    community: one(communities, { fields: [communityInvites.communityId], references: [communities.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
    community: one(communities, { fields: [teams.communityId], references: [communities.id] }),
    memberships: many(teamMemberships),
    homeGames: many(games, { relationName: 'homeGames' }),
    guestGames: many(games, { relationName: 'guestGames' }),
}));

export const athletesRelations = relations(athletes, ({ many }) => ({
    memberships: many(teamMemberships),
    gameAppearances: many(gameRosters),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
    team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
    athlete: one(athletes, { fields: [teamMemberships.athleteId], references: [athletes.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
    community: one(communities, { fields: [games.communityId], references: [communities.id] }),
    homeTeam: one(teams, { fields: [games.homeTeamId], references: [teams.id], relationName: 'homeGames' }),
    guestTeam: one(teams, { fields: [games.guestTeamId], references: [teams.id], relationName: 'guestGames' }),
    rosters: many(gameRosters),
    events: many(gameEvents),
    scorers: many(gameScorers),
}));

export const gameScorersRelations = relations(gameScorers, ({ one }) => ({
    game: one(games, { fields: [gameScorers.gameId], references: [games.id] }),
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
