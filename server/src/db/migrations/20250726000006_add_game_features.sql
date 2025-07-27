-- Add new fields to games table
ALTER TABLE "games" ADD COLUMN "notes" text;
ALTER TABLE "games" ADD COLUMN "status" varchar(20) DEFAULT 'upcoming' NOT NULL;
ALTER TABLE "games" ADD COLUMN "is_shared_to_feed" boolean DEFAULT false NOT NULL;

-- Create game comments table
CREATE TABLE "game_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "game_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX "game_comments_game_id_idx" ON "game_comments" ("game_id");
CREATE INDEX "game_comments_created_at_idx" ON "game_comments" ("created_at");
CREATE INDEX "games_status_idx" ON "games" ("status");