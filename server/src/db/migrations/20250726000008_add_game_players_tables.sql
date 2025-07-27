-- Create manual_players table for unregistered players
CREATE TABLE manual_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  jersey_number INTEGER,
  linked_user_id VARCHAR(255) REFERENCES "user"(id),
  linked_by VARCHAR(255) REFERENCES "user"(id),
  linked_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create game_players table for tracking players in games
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES "user"(id),
  manual_player_id UUID REFERENCES manual_players(id),
  jersey_number INTEGER,
  is_starter BOOLEAN DEFAULT FALSE NOT NULL,
  minutes_played INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Constraint: either user_id or manual_player_id must be set, but not both
  CONSTRAINT check_player_type CHECK (
    (user_id IS NOT NULL AND manual_player_id IS NULL) OR 
    (user_id IS NULL AND manual_player_id IS NOT NULL)
  )
);

-- Create game_stats table for player statistics
CREATE TABLE game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  stat_type VARCHAR(20) NOT NULL CHECK (stat_type IN ('2pt', '3pt', '1pt', 'steal', 'rebound')),
  value INTEGER DEFAULT 1 NOT NULL,
  quarter INTEGER,
  time_minute INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by VARCHAR(255) NOT NULL REFERENCES "user"(id)
);

-- Create game_activities table for activity logging
CREATE TABLE game_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT, -- JSON metadata
  performed_by VARCHAR(255) NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_user_id ON game_players(user_id);
CREATE INDEX idx_game_players_manual_player_id ON game_players(manual_player_id);
CREATE INDEX idx_game_stats_game_id ON game_stats(game_id);
CREATE INDEX idx_game_stats_game_player_id ON game_stats(game_player_id);
CREATE INDEX idx_game_stats_stat_type ON game_stats(stat_type);
CREATE INDEX idx_game_activities_game_id ON game_activities(game_id);
CREATE INDEX idx_manual_players_name ON manual_players(name);
CREATE INDEX idx_manual_players_linked_user_id ON manual_players(linked_user_id);