-- Add isAdmin column and set initial admin
-- Migration: Add platform admin permissions
-- Date: 2025-01-31

-- Add isAdmin column to user table
ALTER TABLE "user" ADD COLUMN "is_admin" BOOLEAN DEFAULT false NOT NULL;

-- Set the initial admin user
UPDATE "user" 
SET "is_admin" = true 
WHERE "email" = 'codydearkland@gmail.com';

-- Verify the update worked
SELECT id, email, role, is_admin FROM "user" WHERE email = 'codydearkland@gmail.com';