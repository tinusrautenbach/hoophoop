-- Migration: Extend game_scorers with stat focus preferences
-- Feature: 078-configurable-player-stats

-- Add stat focus columns to game_scorers
ALTER TABLE game_scorers
    ADD COLUMN IF NOT EXISTS stat_focus JSONB,
    ADD COLUMN IF NOT EXISTS show_all_stats BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS focus_updated_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN game_scorers.stat_focus IS 'Array of 1-3 primary stats for quick access';
COMMENT ON COLUMN game_scorers.show_all_stats IS 'Whether to show all stats expanded by default';
COMMENT ON COLUMN game_scorers.focus_updated_at IS 'When the focus was last changed';
