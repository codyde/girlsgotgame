-- Mark all existing users as verified since they were already using the system
UPDATE "user" SET "is_verified" = true WHERE "is_verified" = false;