-- Remove unused childId column from user table
-- This column was used in the old single-child system but is now replaced by parentChildRelations table

-- Remove the foreign key constraint first
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_child_id_fkey";

-- Remove the column
ALTER TABLE "user" DROP COLUMN IF EXISTS "child_id";