-- Phase 15: Player Invitations, Seasons & Enhanced Search

-- Create season_status enum
DO $$ BEGIN
 CREATE TYPE "public"."season_status" AS ENUM('upcoming', 'active', 'completed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create player_invitations table
CREATE TABLE IF NOT EXISTS "player_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_invitations_token_unique" UNIQUE("token")
);

-- Create seasons table
CREATE TABLE IF NOT EXISTS "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "season_status" DEFAULT 'upcoming' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create team_seasons table
CREATE TABLE IF NOT EXISTS "team_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add new columns to athletes table
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "invited_by" text;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "invited_at" timestamp;

-- Add season_id column to games table
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "season_id" uuid;

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "seasons" ADD CONSTRAINT "seasons_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
