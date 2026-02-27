CREATE TYPE "public"."scorer_invite_status" AS ENUM('pending', 'accepted', 'expired');
--> statement-breakpoint
CREATE TABLE "game_scorer_invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid NOT NULL,
    "email" text,
    "token" text NOT NULL,
    "status" "scorer_invite_status" DEFAULT 'pending' NOT NULL,
    "role" "scorer_role" DEFAULT 'co_scorer' NOT NULL,
    "created_by" text NOT NULL,
    "accepted_by" text,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "game_scorer_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "game_scorer_invites" ADD CONSTRAINT "game_scorer_invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
