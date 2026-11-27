import type { z } from "zod";
import type { plannedCaseSchema, repairVerdictSchema, testPlanSchema, writeReportSchema } from "@/lib/plan-schema";
import type { AppConfig, Run, Scenario } from "@/types/shared.types";

export interface ClaudeOptions {
  cwd?: string;
  mcpConfig?: string;
  permissionMode?: "acceptEdits" | "dontAsk";
  addDirs?: string[];
  env?: Record<string, string>;
  allowedTools?: string[];
  tools?: string[];
  timeoutMs?: number;
}

export interface ClaudeResult {
  text: string;
  costUsd?: number;
  durationMs?: number;
}

export type PlannedCase = z.infer<typeof plannedCaseSchema>;
export type TestPlan = z.infer<typeof testPlanSchema>;
export type RepairVerdict = z.infer<typeof repairVerdictSchema>;
export type WriteReport = z.infer<typeof writeReportSchema>;

export interface ResolvedRef {
  label: string;
  sha: string;
}

export interface RunContext {
  runId: string;
  scenario: Scenario;
  codeDir: string;
  head: ResolvedRef;
  base: ResolvedRef | null;
  changedFiles: string[];
  diffStat: string;
  diff: string;
  diffTruncated: boolean;
}

export interface StepInput {
  run: Run;
  app: AppConfig;
  runDir: string;
}

export type PlanParseResult = { ok: true; plan: TestPlan; droppedEdgeCases: number } | { ok: false; error: string };

export interface SpecTarget {
  caseId: string;
  file: string;
  title: string;
  role: string;
  kind: string;
  steps: string[];
  expected: string;
}
