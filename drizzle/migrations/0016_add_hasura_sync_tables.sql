-- Hasura Real-Time Sync Tables
-- These tables are specifically for Hasura GraphQL subscriptions and real-time game state synchronization

-- Game States table for real-time scoreboard sync
CREATE TABLE IF NOT EXISTS "game_states" (
    "game_id" uuid PRIMARY KEY NOT NULL,
    "home_score" integer DEFAULT 0 NOT NULL,
    "guest_score" integer DEFAULT 0 NOT NULL,
    "home_fouls" integer DEFAULT 0 NOT NULL,
    "guest_fouls" integer DEFAULT 0 NOT NULL,
    "home_timeouts" integer DEFAULT 3 NOT NULL,
    "guest_timeouts" integer DEFAULT 3 NOT NULL,
    "clock_seconds" integer DEFAULT 600 NOT NULL,
    "is_timer_running" boolean DEFAULT false NOT NULL,
    "current_period" integer DEFAULT 1 NOT NULL,
    "possession" text, -- 'home' or 'guest'
    "status" text DEFAULT 'scheduled' NOT NULL, -- 'scheduled', 'live', 'final'
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "updated_by" text,
    CONSTRAINT "game_states_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE
);

-- Game Events table for real-time event streaming (separate from game_events for Hasura optimization)
CREATE TABLE IF NOT EXISTS "hasura_game_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid NOT NULL,
    "event_id" text, -- Client-generated event ID for deduplication
    "type" text NOT NULL,
    "period" integer NOT NULL,
    "clock_at" integer NOT NULL,
    "team" text, -- 'home' or 'guest'
    "player" text,
    "value" integer,
    "metadata" jsonb,
    "description" text NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "created_by" text,
    CONSTRAINT "hasura_game_events_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE
);

-- Timer Sync table for distributed timer state
CREATE TABLE IF NOT EXISTS "timer_sync" (
    "game_id" uuid PRIMARY KEY NOT NULL,
    "is_running" boolean DEFAULT false NOT NULL,
    "started_at" timestamptz,
    "initial_clock_seconds" integer NOT NULL,
    "current_clock_seconds" integer NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "updated_by" text,
    CONSTRAINT "timer_sync_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE
);

-- Indexes for Hasura performance
CREATE INDEX IF NOT EXISTS "idx_game_states_updated_at" ON "game_states"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_hasura_game_events_game_id" ON "hasura_game_events"("game_id");
CREATE INDEX IF NOT EXISTS "idx_hasura_game_events_created_at" ON "hasura_game_events"("created_at");
CREATE INDEX IF NOT EXISTS "idx_timer_sync_updated_at" ON "timer_sync"("updated_at");

-- Enable Row Level Security
ALTER TABLE "game_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasura_game_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timer_sync" ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anonymous access (for public games)
-- In production, you may want to restrict this based on game visibility
DROP POLICY IF EXISTS "Allow anonymous read on game_states" ON "game_states";
CREATE POLICY "Allow anonymous read on game_states" 
    ON "game_states" FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert/update on game_states" ON "game_states";
CREATE POLICY "Allow anonymous insert/update on game_states" 
    ON "game_states" FOR ALL 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous read on hasura_game_events" ON "hasura_game_events";
CREATE POLICY "Allow anonymous read on hasura_game_events" 
    ON "hasura_game_events" FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert/update on hasura_game_events" ON "hasura_game_events";
CREATE POLICY "Allow anonymous insert/update on hasura_game_events" 
    ON "hasura_game_events" FOR ALL 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous read on timer_sync" ON "timer_sync";
CREATE POLICY "Allow anonymous read on timer_sync" 
    ON "timer_sync" FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert/update on timer_sync" ON "timer_sync";
CREATE POLICY "Allow anonymous insert/update on timer_sync" 
    ON "timer_sync" FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Trigger function to sync game_states with games table
CREATE OR REPLACE FUNCTION sync_game_state_to_games()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "games" SET
        "home_score" = NEW.home_score,
        "guest_score" = NEW.guest_score,
        "home_fouls" = NEW.home_fouls,
        "guest_fouls" = NEW.guest_fouls,
        "home_timeouts" = NEW.home_timeouts,
        "guest_timeouts" = NEW.guest_timeouts,
        "clock_seconds" = NEW.clock_seconds,
        "is_timer_running" = NEW.is_timer_running,
        "current_period" = NEW.current_period,
        "possession" = NEW.possession::team_side,
        "status" = NEW.status::game_status,
        "updated_at" = NEW.updated_at
    WHERE "id" = NEW.game_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update games table when game_states changes
DROP TRIGGER IF EXISTS trigger_sync_game_state ON "game_states";
CREATE TRIGGER trigger_sync_game_state
    AFTER INSERT OR UPDATE ON "game_states"
    FOR EACH ROW
    EXECUTE FUNCTION sync_game_state_to_games();

-- Trigger function to sync timer changes
CREATE OR REPLACE FUNCTION sync_timer_to_games()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "games" SET
        "is_timer_running" = NEW.is_running,
        "timer_started_at" = NEW.started_at,
        "timer_offset_seconds" = NEW.initial_clock_seconds - NEW.current_clock_seconds,
        "updated_at" = NEW.updated_at
    WHERE "id" = NEW.game_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync timer changes
DROP TRIGGER IF EXISTS trigger_sync_timer ON "timer_sync";
CREATE TRIGGER trigger_sync_timer
    AFTER INSERT OR UPDATE ON "timer_sync"
    FOR EACH ROW
    EXECUTE FUNCTION sync_timer_to_games();
