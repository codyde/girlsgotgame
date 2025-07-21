DROP TABLE "profiles";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_url" varchar(500);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" varchar(20) DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "child_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "jersey_number" integer;