ALTER TABLE "games" ADD COLUMN "timer_started_at" timestamp;
ALTER TABLE "games" ADD COLUMN "timer_offset_seconds" integer DEFAULT 0;
