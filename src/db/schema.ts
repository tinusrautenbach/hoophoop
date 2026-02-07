import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const teamEnum = pgEnum('team_side', ['home', 'guest']);
export const eventTypeEnum = pgEnum('event_type', [
    'score', 'foul', 'timeout', 'sub', 'turnover',
    'block', 'steal', 'rebound_off', 'rebound_def',
    'period_start', 'period_end', 'clock_start', 'clock_stop', 'undo'
]);
export const gameStatusEnum = pgEnum('game_status', ['scheduled', 'live', 'final']);

// Tables
export const games = pgTable('games', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(), // Clerk User ID
    homeTeamName: text('home_team_name').notNull(),
    guestTeamName: text('guest_team_name').notNull(),
    status: gameStatusEnum('status').default('scheduled').notNull(),

    // Snapshot State (Optimized for quick reads)
    currentPeriod: integer('current_period').default(1).notNull(),
    clockSeconds: integer('clock_seconds').default(600).notNull(), // e.g. 10 mins
    homeScore: integer('home_score').default(0).notNull(),
    guestScore: integer('guest_score').default(0).notNull(),
    homeFouls: integer('home_fouls').default(0).notNull(),
    guestFouls: integer('guest_fouls').default(0).notNull(),
    possession: teamEnum('possession'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const players = pgTable('players', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    team: teamEnum('team').notNull(),
    name: text('name').notNull(),
    number: text('number').notNull(),
    isActive: boolean('is_active').default(false).notNull(), // Currently on court?

    // Denormalized Stats for quick access (MVP)
    points: integer('points').default(0).notNull(),
    fouls: integer('fouls').default(0).notNull(),
});

export const gameEvents = pgTable('game_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
    type: eventTypeEnum('type').notNull(),

    // Context
    period: integer('period').notNull(),
    clockAt: integer('clock_at').notNull(),
    team: teamEnum('team'),
    playerId: uuid('player_id').references(() => players.id),

    // Data
    value: integer('value'), // Points amount, etc.
    metadata: jsonb('metadata'), // Extra info (subs, shot coords)
    description: text('description').notNull(), // Human readable log

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const gamesRelations = relations(games, ({ many }) => ({
    players: many(players),
    events: many(gameEvents),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
    game: one(games, {
        fields: [players.gameId],
        references: [games.id],
    }),
    events: many(gameEvents),
}));

export const gameEventsRelations = relations(gameEvents, ({ one }) => ({
    game: one(games, {
        fields: [gameEvents.gameId],
        references: [games.id],
    }),
    player: one(players, {
        fields: [gameEvents.playerId],
        references: [players.id],
    }),
}));
