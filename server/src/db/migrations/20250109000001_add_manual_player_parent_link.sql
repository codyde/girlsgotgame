-- Add parent linking fields to manual_players table
ALTER TABLE manual_players 
ADD COLUMN parent_id VARCHAR(255),
ADD COLUMN parent_linked_by VARCHAR(255),
ADD COLUMN parent_linked_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manual_players_parent_id ON manual_players(parent_id);
CREATE INDEX IF NOT EXISTS idx_manual_players_parent_linked_by ON manual_players(parent_linked_by);