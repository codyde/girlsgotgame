-- Add statsLocked field to games table to allow admins to lock game stats after completion
ALTER TABLE games ADD COLUMN stats_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment to document the field
COMMENT ON COLUMN games.stats_locked IS 'When true, prevents players from adding/modifying stats for this game. Only admins can modify.';