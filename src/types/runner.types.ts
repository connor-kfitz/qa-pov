import type { z } from "zod";
import type { plannedCaseSchema, repairVerdictSchema, testPlanSchema } from "@/lib/plan-schema";

export interface ClaudeOptions {
  cwd?: string;
  withBrowser?: boolean;
  allowedTools?: string[];
}

export interface ClaudeResult {
  text: string;
  costUsd?: number;
  durationMs?: number;
}

export type PlannedCase = z.infer<typeof plannedCaseSchema>;
export type TestPlan = z.infer<typeof testPlanSchema>;
export type RepairVerdict = z.infer<typeof repairVerdictSchema>;
