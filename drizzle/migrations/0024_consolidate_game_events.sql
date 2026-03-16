-- Migration: 0024_consolidate_game_events.sql
-- Consolidate game_events: migrate data from hasura_game_events to game_events, then drop hasura_game_events

BEGIN;

-- Step 1: Copy any events from hasura_game_events that don't exist in game_events
-- This ensures we don't lose any data that was only written to hasura_game_events
INSERT INTO game_events (
    id,
    game_id,
    type,
    period,
    clock_at,
    team,
    player,
    value,
    metadata,
    description,
    created_at,
    created_by
)
SELECT 
    he.id,
    he.game_id,
    he.type,
    he.period,
    he.clock_at,
    he.team,
    he.player,
    he.value,
    he.metadata,
    he.description,
    he.created_at,
    he.created_by
FROM hasura_game_events he
WHERE NOT EXISTS (
    SELECT 1 FROM game_events ge 
    WHERE ge.id = he.id
);

-- Step 2: Drop the hasura_game_events table
DROP TABLE IF EXISTS hasura_game_events CASCADE;

COMMIT;
