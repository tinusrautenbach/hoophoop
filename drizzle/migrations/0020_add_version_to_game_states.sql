-- Add version column to game_states for optimistic concurrency control
-- This column was defined in the Drizzle schema but was missing from the
-- original 0016_add_hasura_sync_tables.sql migration.
ALTER TABLE "game_states"
    ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
