import path from "node:path";

import { readFile, rm } from "node:fs/promises";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { flattenReport, truncate } from "@/lib/helpers";
import { playwrightReportSchema } from "@/lib/plan-schema";
import { resolveRunPath, toRunRelativePath } from "@/lib/run-files";
import { runPlaywright } from "@/runner/playwright";
import { EnvProblemError } from "@/runner/prepare";
import type { ReportedTest, StepInput } from "@/types/runner.types";

const artifactTypes = ["video", "screenshot", "trace"] as const;
const maxErrorChars = 2000;

export async function runTests({ run, app, runDir }: StepInput) {
  const reportFile = path.join(runDir, "report.json");
  await rm(reportFile, { force: true });
  await rm(path.join(runDir, "test-results"), { recursive: true, force: true });

  const exitCode = await runPlaywright(["test"], { QA_APP: app.slug, QA_RUN_DIR: runDir, QA_ROOT: process.cwd() });
  const raw = await readFile(reportFile, "utf8").catch(() => null);
  if (!raw) throw new Error(`Playwright didn't write a report (exit code ${exitCode})`);

  const parsed = playwrightReportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error(`Couldn't read Playwright's report: ${parsed.error.issues[0].message}`);
  const results = flattenReport(parsed.data);

  const signInFailure = results.find((result) => result.project === "setup" && result.status === "failed");
  if (signInFailure) throw new EnvProblemError(`${signInFailure.title} failed: ${truncate(signInFailure.error ?? "", 300).text}`);

  const cases = await db.select().from(schema.testCases).where(and(eq(schema.testCases.runId, run.id), isNotNull(schema.testCases.specPath)));
  const counts: Record<string, number> = {}

  for (const testCase of cases) {
    const result = results.find((reported) => reported.project !== "setup" && path.basename(reported.file) === path.basename(testCase.specPath!));
    const status = result?.status ?? "skipped";
    counts[status] = (counts[status] ?? 0) + 1;

    const baseNotes = (testCase.notes ?? "").split(/\n\n(?:Failure|Repair):/)[0];
    const failure = result?.error ? `\n\nFailure: ${truncate(result.error, maxErrorChars).text}` : "";
    const notes = result ? `${baseNotes}${status === "passed" ? "" : failure}` : `${baseNotes}\n\nFailure: Playwright didn't run this test.`;

    await db.update(schema.testCases).set({ status, verdict: null, durationMs: result ? Math.round(result.durationMs) : null, notes: notes.trim() || null }).where(eq(schema.testCases.id, testCase.id));
    await replaceArtifacts(run.id, testCase.id, result);
  }

  console.log(`Ran ${cases.length} tests: ${Object.entries(counts).map(([status, total]) => `${total} ${status}`).join(", ")}`);
}

export async function replaceArtifacts(runId: string, testCaseId: string, result: ReportedTest | undefined) {
  await db.delete(schema.artifacts).where(eq(schema.artifacts.testCaseId, testCaseId));
  const files = (result?.attachments ?? []).flatMap((attachment) => {
    const type = artifactTypes.find((name) => name === attachment.name);
    return type && resolveRunPath(attachment.path) ? [{ runId, testCaseId, type, path: toRunRelativePath(attachment.path) }] : [];
  });
  if (files.length > 0) await db.insert(schema.artifacts).values(files);
}
