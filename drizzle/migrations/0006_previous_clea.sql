ALTER TABLE "athletes" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "surname" text;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "is_world_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_world_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Data migration: Split existing 'name' into 'first_name' and 'surname'
-- For names with spaces: first word = first_name, rest = surname
-- For names without spaces: entire name = first_name, surname = ''
UPDATE "athletes"
SET
  "first_name" = CASE
    WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1)
    ELSE "name"
  END,
  "surname" = CASE
    WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1)
    ELSE ''
  END
WHERE "first_name" IS NULL;