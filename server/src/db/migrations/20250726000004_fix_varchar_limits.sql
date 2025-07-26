-- Fix varchar length limits for OAuth tokens and scopes
ALTER TABLE "session" ALTER COLUMN "token" TYPE text;
ALTER TABLE "account" ALTER COLUMN "scope" TYPE text;