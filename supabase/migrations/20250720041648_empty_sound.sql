/*
  # Add Parent-Child System

  1. Schema Changes
    - Add `role` column to profiles (parent/player)
    - Add `child_id` column to profiles for parent-child relationships
    - Add `is_onboarded` column to track if user completed role selection

  2. Security
    - Update RLS policies to handle new columns
    - Allow parents to view their assigned child's data

  3. Data Migration
    - Set existing users as players by default
    - Mark existing users as onboarded
*/

-- Add new columns to profiles table
DO $$
BEGIN
  -- Add role column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'player' CHECK (role IN ('parent', 'player'));
  END IF;

  -- Add child_id column for parent-child relationships
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'child_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN child_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add is_onboarded column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_onboarded'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_onboarded boolean DEFAULT false;
  END IF;
END $$;

-- Update existing users to be onboarded players
UPDATE profiles 
SET role = 'player', is_onboarded = true 
WHERE role IS NULL OR is_onboarded IS NULL;

-- Create index for child relationships
CREATE INDEX IF NOT EXISTS profiles_child_id_idx ON profiles(child_id);

-- Update RLS policies to handle parent-child relationships
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
CREATE POLICY "Users can read all profiles and parent-child data"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow parents to update their child assignment
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow parents to view their child's workouts
DROP POLICY IF EXISTS "Users can read all workouts" ON profiles;
CREATE POLICY "Users can read workouts and child workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    user_id IN (
      SELECT child_id FROM profiles 
      WHERE id = auth.uid() AND role = 'parent' AND child_id IS NOT NULL
    )
  );