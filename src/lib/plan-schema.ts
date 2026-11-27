import { z } from "zod";

export const plannedCaseSchema = z.object({
  title: z.string().min(1),
  role: z.string().min(1),
  kind: z.enum(["base", "edge"]),
  steps: z.array(z.string().min(1)).min(1),
  expected: z.string().min(1)
});

export const testPlanSchema = z.object({
  cases: z.array(plannedCaseSchema).min(1)
});

export const repairVerdictSchema = z.object({
  specPath: z.string(),
  verdict: z.enum(["app_bug", "bad_test", "env_problem"]),
  notes: z.string(),
  fixed: z.boolean()
});

export type PlannedCase = z.infer<typeof plannedCaseSchema>;
export type TestPlan = z.infer<typeof testPlanSchema>;
export type RepairVerdict = z.infer<typeof repairVerdictSchema>;
