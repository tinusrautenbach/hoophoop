import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const teamEnum = pgEnum('team_side', ['home', 'guest']);
export const eventTypeEnum = pgEnum('event_type', [
    'score', 'foul', 'timeout', 'sub', 'turnover',
    'block', 'steal', 'rebound_off', 'rebound_def',
    'period_start', 'period_end', 'clock_start', 'clock_stop', 'undo'
]);
export const gameStatusEnum = pgEnum('game_status', ['scheduled', 'live', 'final']);
export const gameModeEnum = pgEnum('game_mode', ['simple', 'advanced']);


// --- CORE ROSTER ENTITIES ---

export const teams = pgTable('teams', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    shortCode: text('short_code'), // LAL, BOS
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const athletes = pgTable('athletes', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(), // Who created this profile?
    name: text('name').notNull(),
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
});

// --- GAME ENTITIES ---

export const games = pgTable('games', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(),

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
    possession: teamEnum('possession'),
    mode: gameModeEnum('mode').default('simple').notNull(),


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

    // References gameRoster record, NOT athlete directly (to handle ad-hoc players)
    gameRosterId: uuid('game_roster_id').references(() => gameRosters.id),

    value: integer('value'),
    metadata: jsonb('metadata'),
    description: text('description').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- RELATIONS ---

export const teamsRelations = relations(teams, ({ many }) => ({
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
    homeTeam: one(teams, { fields: [games.homeTeamId], references: [teams.id], relationName: 'homeGames' }),
    guestTeam: one(teams, { fields: [games.guestTeamId], references: [teams.id], relationName: 'guestGames' }),
    rosters: many(gameRosters),
    events: many(gameEvents),
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
