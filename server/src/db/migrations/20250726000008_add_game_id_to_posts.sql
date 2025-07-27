-- Add gameId field and post_type to posts table to support game posts
ALTER TABLE "posts" ADD COLUMN "game_id" uuid;
ALTER TABLE "posts" ADD COLUMN "post_type" varchar(20) DEFAULT 'text' NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "content" DROP NOT NULL;