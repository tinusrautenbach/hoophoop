-- Migration: Extend game_events with audit fields for stat tracking
-- Feature: 078-configurable-player-stats

-- Add stat type and audit fields to game_events
ALTER TABLE game_events 
    ADD COLUMN IF NOT EXISTS stat_type TEXT,
    ADD COLUMN IF NOT EXISTS modified_by TEXT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS previous_version JSONB;

-- Create indexes for stat queries
CREATE INDEX IF NOT EXISTS idx_game_events_stat_type ON game_events(game_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_game_events_game_roster ON game_events(game_id, game_roster_id);
CREATE INDEX IF NOT EXISTS idx_game_events_modified_at ON game_events(modified_at);

-- Add comments for documentation
COMMENT ON COLUMN game_events.stat_type IS 'Type of stat recorded (e.g., points_2pt, rebound_off)';
COMMENT ON COLUMN game_events.modified_by IS 'User who last edited this event';
COMMENT ON COLUMN game_events.modified_at IS 'Timestamp of last modification';
COMMENT ON COLUMN game_events.version IS 'Version number for audit trail (starts at 1)';
COMMENT ON COLUMN game_events.previous_version IS 'Previous event data for full audit history';
