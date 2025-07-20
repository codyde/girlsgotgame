/*
  # Enable Realtime for Social Features
  
  1. Enable realtime replication for all tables
  2. Add jersey_number field for players
  3. Ensure proper realtime subscriptions work
*/

-- Enable realtime replication for all tables
ALTER publication supabase_realtime ADD TABLE posts;
ALTER publication supabase_realtime ADD TABLE likes;
ALTER publication supabase_realtime ADD TABLE comments;
ALTER publication supabase_realtime ADD TABLE profiles;
ALTER publication supabase_realtime ADD TABLE workouts;

-- Add jersey_number field for players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'jersey_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN jersey_number integer;
  END IF;
END $$;

-- Create index for jersey number lookups
CREATE INDEX IF NOT EXISTS profiles_jersey_number_idx ON profiles(jersey_number) WHERE jersey_number IS NOT NULL;

-- Ensure realtime is working by refreshing the publication
ALTER publication supabase_realtime REFRESH PUBLICATION;