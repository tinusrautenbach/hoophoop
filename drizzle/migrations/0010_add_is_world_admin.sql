-- Add is_world_admin column to users table
ALTER TABLE "users" ADD COLUMN "is_world_admin" boolean DEFAULT false;

-- Update existing users to have is_world_admin set to false
UPDATE "users" SET "is_world_admin" = false WHERE "is_world_admin" IS NULL;

-- Make is_world_admin column not null
ALTER TABLE "users" ALTER COLUMN "is_world_admin" SET NOT NULL;
