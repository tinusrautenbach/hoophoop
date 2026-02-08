CREATE TYPE "public"."community_role" AS ENUM('admin', 'scorer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."community_type" AS ENUM('school', 'club', 'league', 'other');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."scorer_role" AS ENUM('owner', 'co_scorer', 'viewer');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'miss';--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "community_type" DEFAULT 'other' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "community_role" DEFAULT 'scorer' NOT NULL,
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "community_role" DEFAULT 'scorer' NOT NULL,
	"can_manage_games" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_scorers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "scorer_role" DEFAULT 'co_scorer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"performed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"community_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "player" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "scheduled_date" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "total_periods" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "period_seconds" integer DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "home_timeouts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "guest_timeouts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "total_timeouts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "is_timer_running" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "timer_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "timer_offset_seconds" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_scorers" ADD CONSTRAINT "game_scorers_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_history" ADD CONSTRAINT "player_history_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_history" ADD CONSTRAINT "player_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;