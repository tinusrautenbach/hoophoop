ALTER TABLE "tournament_games" ADD COLUMN "home_fouls" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "guest_fouls" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "player_of_the_match_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "home_3_pointers" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "guest_3_pointers" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "home_free_throws" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD COLUMN "guest_free_throws" integer;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_player_of_the_match_id_athletes_id_fk" FOREIGN KEY ("player_of_the_match_id") REFERENCES "public"."athletes"("id") ON DELETE set null ON UPDATE no action;