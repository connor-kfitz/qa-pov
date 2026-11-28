ALTER TABLE "claude_calls" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "models" jsonb DEFAULT '{}'::jsonb NOT NULL;