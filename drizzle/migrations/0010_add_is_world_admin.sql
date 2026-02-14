-- Add is_world_admin column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='is_world_admin'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "is_world_admin" boolean DEFAULT false;
    END IF;
END $$;

-- Update existing users to have is_world_admin set to false
UPDATE "users" SET "is_world_admin" = false WHERE "is_world_admin" IS NULL;

-- Make is_world_admin column not null
DO $$
BEGIN
    ALTER TABLE "users" ALTER COLUMN "is_world_admin" SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;
