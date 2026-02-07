CREATE TYPE "public"."event_type" AS ENUM('score', 'foul', 'timeout', 'sub', 'turnover', 'block', 'steal', 'rebound_off', 'rebound_def', 'period_start', 'period_end', 'clock_start', 'clock_stop', 'undo');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'live', 'final');--> statement-breakpoint
CREATE TYPE "public"."team_side" AS ENUM('home', 'guest');--> statement-breakpoint
CREATE TABLE "athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"type" "event_type" NOT NULL,
	"period" integer NOT NULL,
	"clock_at" integer NOT NULL,
	"team" "team_side",
	"game_roster_id" uuid,
	"value" integer,
	"metadata" jsonb,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rosters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team" "team_side" NOT NULL,
	"athlete_id" uuid,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"fouls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"home_team_id" uuid,
	"guest_team_id" uuid,
	"home_team_name" text NOT NULL,
	"guest_team_name" text NOT NULL,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"current_period" integer DEFAULT 1 NOT NULL,
	"clock_seconds" integer DEFAULT 600 NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"guest_score" integer DEFAULT 0 NOT NULL,
	"home_fouls" integer DEFAULT 0 NOT NULL,
	"guest_fouls" integer DEFAULT 0 NOT NULL,
	"possession" "team_side",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"number" text,
	"start_date" date DEFAULT now() NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"short_code" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_roster_id_game_rosters_id_fk" FOREIGN KEY ("game_roster_id") REFERENCES "public"."game_rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rosters" ADD CONSTRAINT "game_rosters_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rosters" ADD CONSTRAINT "game_rosters_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_guest_team_id_teams_id_fk" FOREIGN KEY ("guest_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;