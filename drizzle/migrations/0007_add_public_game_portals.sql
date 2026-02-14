CREATE TYPE "public"."game_visibility" AS ENUM('private', 'public_general', 'public_community');--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "visibility" "game_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_slug_unique" UNIQUE("slug");