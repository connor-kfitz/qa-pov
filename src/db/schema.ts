import { boolean, doublePrecision, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { StepModels } from "@/types/shared.types";

export const scenarioEnum = pgEnum("scenario", ["codebase", "feature"]);
export const depthEnum = pgEnum("depth", ["base", "base_edge"]);
export const runStatusEnum = pgEnum("run_status", ["queued", "preparing", "planning", "writing", "running", "repairing", "saving", "done", "failed", "blocked"]);
export const caseKindEnum = pgEnum("case_kind", ["base", "edge"]);
export const caseStatusEnum = pgEnum("case_status", ["planned", "written", "passed", "failed", "flaky", "skipped"]);
export const verdictEnum = pgEnum("verdict", ["app_bug", "bad_test", "env_problem"]);
export const artifactTypeEnum = pgEnum("artifact_type", ["video", "screenshot", "trace", "log"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const apps = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  repoPath: text("repo_path").notNull(),
  createdAt: createdAt()
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id").notNull().references(() => apps.id),
  scenario: scenarioEnum("scenario").notNull(),
  depth: depthEnum("depth").notNull().default("base"),
  maxTests: integer("max_tests"),
  foundCases: integer("found_cases"),
  models: jsonb("models").$type<StepModels>().notNull().default({}),
  compareRef: text("compare_ref"),
  featureRef: text("feature_ref"),
  status: runStatusEnum("status").notNull().default("queued"),
  retryFrom: runStatusEnum("retry_from"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  error: text("error"),
  deployedCommitStart: text("deployed_commit_start"),
  deployedCommitEnd: text("deployed_commit_end"),
  envChanged: boolean("env_changed").notNull().default(false),
  plan: jsonb("plan"),
  createdAt: createdAt(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  role: text("role").notNull(),
  kind: caseKindEnum("kind").notNull(),
  steps: jsonb("steps").$type<string[]>().notNull(),
  expected: text("expected").notNull(),
  specPath: text("spec_path"),
  status: caseStatusEnum("status").notNull().default("planned"),
  verdict: verdictEnum("verdict"),
  notes: text("notes"),
  durationMs: integer("duration_ms"),
  createdAt: createdAt()
});

export const claudeCalls = pgTable("claude_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  step: runStatusEnum("step").notNull(),
  label: text("label").notNull(),
  model: text("model"),
  ok: boolean("ok").notNull(),
  costUsd: doublePrecision("cost_usd"),
  durationMs: integer("duration_ms"),
  turns: integer("turns"),
  createdAt: createdAt()
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id").references(() => testCases.id, { onDelete: "cascade" }),
  type: artifactTypeEnum("type").notNull(),
  path: text("path").notNull(),
  createdAt: createdAt()
});
