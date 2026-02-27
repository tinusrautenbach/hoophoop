-- Migration: change game_scorers timestamp columns to timestamptz
-- Required because Hasura expects timestamptz for the UpsertScorerPresence mutation

ALTER TABLE game_scorers
  ALTER COLUMN joined_at TYPE timestamptz USING joined_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_active_at TYPE timestamptz USING last_active_at AT TIME ZONE 'UTC';
