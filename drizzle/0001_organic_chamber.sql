CREATE TABLE "claude_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step" "run_status" NOT NULL,
	"label" text NOT NULL,
	"ok" boolean NOT NULL,
	"cost_usd" double precision,
	"duration_ms" integer,
	"turns" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claude_calls" ADD CONSTRAINT "claude_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;