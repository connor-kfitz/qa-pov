CREATE TYPE "public"."artifact_type" AS ENUM('video', 'screenshot', 'trace', 'log');--> statement-breakpoint
CREATE TYPE "public"."case_kind" AS ENUM('base', 'edge');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('planned', 'written', 'passed', 'failed', 'flaky', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."depth" AS ENUM('base', 'base_edge');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'preparing', 'planning', 'writing', 'running', 'repairing', 'saving', 'done', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."scenario" AS ENUM('codebase', 'feature');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('app_bug', 'bad_test', 'env_problem');--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"repo_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"test_case_id" uuid,
	"type" "artifact_type" NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"scenario" "scenario" NOT NULL,
	"depth" "depth" DEFAULT 'base' NOT NULL,
	"max_tests" integer,
	"compare_ref" text,
	"feature_ref" text,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"deployed_commit_start" text,
	"deployed_commit_end" text,
	"env_changed" boolean DEFAULT false NOT NULL,
	"plan" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"title" text NOT NULL,
	"role" text NOT NULL,
	"kind" "case_kind" NOT NULL,
	"steps" jsonb NOT NULL,
	"expected" text NOT NULL,
	"spec_path" text,
	"status" "case_status" DEFAULT 'planned' NOT NULL,
	"verdict" "verdict",
	"notes" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;