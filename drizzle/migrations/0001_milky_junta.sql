CREATE TYPE "public"."game_mode" AS ENUM('simple', 'advanced');--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "mode" "game_mode" DEFAULT 'simple' NOT NULL;