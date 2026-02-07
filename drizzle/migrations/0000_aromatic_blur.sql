CREATE TYPE "public"."event_type" AS ENUM('score', 'foul', 'timeout', 'sub', 'turnover', 'block', 'steal', 'rebound_off', 'rebound_def', 'period_start', 'period_end', 'clock_start', 'clock_stop', 'undo');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'live', 'final');--> statement-breakpoint
CREATE TYPE "public"."team_side" AS ENUM('home', 'guest');--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"type" "event_type" NOT NULL,
	"period" integer NOT NULL,
	"clock_at" integer NOT NULL,
	"team" "team_side",
	"player_id" uuid,
	"value" integer,
	"metadata" jsonb,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
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
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team" "team_side" NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"fouls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;