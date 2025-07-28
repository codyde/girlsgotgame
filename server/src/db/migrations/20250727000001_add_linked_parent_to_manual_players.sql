-- Add linked_parent_id column to manual_players table
ALTER TABLE "manual_players" ADD COLUMN "linked_parent_id" varchar(255);

-- Add index for performance
CREATE INDEX IF NOT EXISTS "manual_players_linked_parent_id_idx" ON "manual_players" ("linked_parent_id");