-- Add theme preference to users table
ALTER TABLE "users" ADD COLUMN "theme" text DEFAULT 'dark';

-- Create theme enum type
CREATE TYPE "theme" AS ENUM ('light', 'dark');

-- Update existing users to use dark theme as default
UPDATE "users" SET "theme" = 'dark' WHERE "theme" IS NULL;

-- Make theme column not null
ALTER TABLE "users" ALTER COLUMN "theme" SET NOT NULL;
