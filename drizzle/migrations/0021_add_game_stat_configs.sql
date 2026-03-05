-- Migration: Add game_stat_configs table for configurable player statistics
-- Feature: 078-configurable-player-stats

CREATE TABLE IF NOT EXISTS game_stat_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    season_id UUID REFERENCES seasons(id),
    community_id UUID REFERENCES communities(id),
    enabled_stats JSONB NOT NULL DEFAULT '["points_2pt", "points_3pt", "rebound_off", "rebound_def", "assist"]'::jsonb,
    display_config JSONB DEFAULT '{}'::jsonb,
    allow_customization BOOLEAN NOT NULL DEFAULT true,
    track_full_history BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by TEXT REFERENCES users(id),
    updated_by TEXT REFERENCES users(id),
    UNIQUE (game_id)
);

-- Create indexes for common queries
CREATE INDEX idx_game_stat_configs_game_id ON game_stat_configs(game_id);
CREATE INDEX idx_game_stat_configs_season_id ON game_stat_configs(season_id);
CREATE INDEX idx_game_stat_configs_community_id ON game_stat_configs(community_id);

-- Add comment for documentation
COMMENT ON TABLE game_stat_configs IS 'Per-game configuration of which player statistics are tracked';
COMMENT ON COLUMN game_stat_configs.enabled_stats IS 'Array of enabled PrimaryStatType values';
COMMENT ON COLUMN game_stat_configs.display_config IS 'Display preferences including stat order and groupings';
