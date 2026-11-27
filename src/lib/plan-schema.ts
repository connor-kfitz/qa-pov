import { z } from "zod";
import type { ReportSuite } from "@/types/runner.types";

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
  file: z.string(),
  verdict: z.enum(["app_bug", "bad_test", "env_problem"]),
  notes: z.string(),
  fixed: z.boolean()
});

export const repairReportSchema = z.object({ cases: z.array(repairVerdictSchema) });

export const writeReportSchema = z.object({
  cases: z.array(
    z.object({
      file: z.string(),
      status: z.enum(["passed", "failed"]),
      note: z.string()
    })
  )
});

const reportResultSchema = z.object({
  status: z.string(),
  duration: z.number(),
  error: z.object({ message: z.string().optional() }).optional(),
  attachments: z.array(z.object({ name: z.string(), path: z.string().optional() }))
});

export const reportSpecSchema = z.object({
  title: z.string(),
  file: z.string(),
  tests: z.array(z.object({ projectName: z.string(), status: z.string(), results: z.array(reportResultSchema) }))
});

const reportSuiteSchema: z.ZodType<ReportSuite> = z.lazy(() => z.object({ specs: z.array(reportSpecSchema).optional(), suites: z.array(reportSuiteSchema).optional() }));

export const playwrightReportSchema = z.object({ suites: z.array(reportSuiteSchema) });
