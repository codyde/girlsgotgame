-- Create games table for basketball game schedule
CREATE TABLE "games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_name" varchar(255) NOT NULL,
  "is_home" boolean NOT NULL,
  "opponent_team" varchar(255) NOT NULL,
  "game_date" timestamp NOT NULL,
  "home_score" integer,
  "away_score" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index on game_date for performance
CREATE INDEX "games_game_date_idx" ON "games" ("game_date");