import path from "node:path";

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { diffFiles } from "@/lib/git";
import { flattenReport, parseAnswer, pluralize, toPosix, truncate } from "@/lib/helpers";
import { playwrightReportSchema, repairReportSchema } from "@/lib/plan-schema";
import { repairDiffPath } from "@/lib/run-files";
import { askClaude } from "@/runner/claude";
import { runPlaywright } from "@/runner/playwright";
import { EnvProblemError } from "@/runner/prepare";
import { buildRepairPrompt } from "@/runner/prompts";
import { replaceArtifacts } from "@/runner/run";
import { fixtureImport, runnerEnv, sessionAllowedTools, sessionTools, verifyCommand, writeBrowserConfig } from "@/runner/session";
import type { RepairReport, RepairTarget, ReportedTest, StepInput } from "@/types/runner.types";

const repairTimeoutMs = 30 * 60_000;
const maxErrorChars = 4000;
const evidenceNames = ["screenshot", "error-context"];

export async function repair({ run, app, runDir }: StepInput) {
  const failed = await db
    .select()
    .from(schema.testCases)
    .where(and(eq(schema.testCases.runId, run.id), eq(schema.testCases.status, "failed"), isNotNull(schema.testCases.specPath)))
    .orderBy(asc(schema.testCases.title));

  if (failed.length === 0) {
    console.log("No failures to repair");
    return;
  }

  const testsDir = path.join(runDir, "tests");
  const repairDir = path.join(runDir, "repair");
  const originalsDir = path.join(repairDir, "originals");
  await rm(repairDir, { recursive: true, force: true });
  await mkdir(originalsDir, { recursive: true });
  const env = runnerEnv(app, runDir);

  const results = await readReport(path.join(runDir, "report.json"));
  const targets: RepairTarget[] = failed.map((testCase) => {
    const file = path.basename(testCase.specPath!);
    const result = results.find((reported) => reported.project !== "setup" && path.basename(reported.file) === file);
    return {
      caseId: testCase.id,
      file,
      title: testCase.title,
      role: testCase.role,
      kind: testCase.kind,
      steps: testCase.steps,
      expected: testCase.expected,
      error: truncate(result?.error ?? "No error was recorded.", maxErrorChars).text,
      evidence: (result?.attachments ?? []).filter((attachment) => evidenceNames.includes(attachment.name)).map((attachment) => toPosix(attachment.path))
    }
  });

  for (const target of targets) await copyFile(path.join(testsDir, target.file), path.join(originalsDir, target.file));

  const verdicts: RepairReport["cases"] = [];
  for (const role of [...new Set(targets.map((target) => target.role))]) {
    const group = targets.filter((target) => target.role === role);
    const prompt = buildRepairPrompt(run, app, role, group, { fixtureImport: fixtureImport(testsDir), verifyCommand: verifyCommand(role, path.join(repairDir, "claude-results")) });
    await writeFile(path.join(repairDir, `prompt-${role}.md`), prompt);

    console.log(`Repairing ${group.length} failed ${role} tests`);
    const result = await askClaude({ runId: run.id, step: "repairing", label: `${role}: ${pluralize(group.length, "failed test")}` }, prompt, {
      cwd: testsDir,
      tools: sessionTools,
      allowedTools: sessionAllowedTools,
      permissionMode: "acceptEdits",
      addDirs: [runDir],
      mcpConfig: await writeBrowserConfig(repairDir, app, role),
      env,
      timeoutMs: repairTimeoutMs
    });
    await writeFile(path.join(repairDir, `answer-${role}.md`), result.text);
    console.log(`Repair session for ${role}: ${Math.round((result.durationMs ?? 0) / 1000)}s, $${(result.costUsd ?? 0).toFixed(2)}`);
    verdicts.push(...(parseAnswer(result.text, repairReportSchema)?.cases ?? []));
  }

  const changed: string[] = [];
  const reverted = new Set<string>();
  for (const target of targets) {
    const original = path.join(originalsDir, target.file);
    const current = path.join(testsDir, target.file);
    const [before, after] = await Promise.all([readFile(original, "utf8"), readFile(current, "utf8")]);
    if (before === after) continue;

    if (countExpects(after) < countExpects(before)) {
      await copyFile(original, current);
      reverted.add(target.file);
      console.log(`${target.file}: repair removed assertions, reverted`);
      continue;
    }
    await writeFile(repairDiffPath(run.id, target.file), await diffFiles(original, current));
    changed.push(target.file);
  }

  const rerun = changed.length > 0 ? await rerunTests(changed, repairDir, env) : [];

  let stillFailing = 0;
  let envProblems = 0;
  for (const target of targets) {
    const verdict = verdicts.find((entry) => path.basename(entry.file) === target.file);
    const retried = rerun.find((reported) => path.basename(reported.file) === target.file);
    const testCase = failed.find((row) => row.id === target.caseId)!;
    const baseNotes = (testCase.notes ?? "").split(/\n\nRepair:/)[0];

    if (retried && (retried.status === "passed" || retried.status === "flaky")) {
      const notes = `${baseNotes.split(/\n\nFailure:/)[0]}\n\nRepair: the test was wrong and was fixed; it passes on re-run. ${verdict?.notes ?? ""}`;
      await db.update(schema.testCases).set({ status: retried.status, verdict: "bad_test", durationMs: Math.round(retried.durationMs), notes: notes.trim() }).where(eq(schema.testCases.id, target.caseId));
      await replaceArtifacts(run.id, target.caseId, retried);
      continue;
    }

    stillFailing += 1;
    if (verdict?.verdict === "env_problem") envProblems += 1;
    const revertNote = reverted.has(target.file) ? " The attempted fix removed assertions, so it was reverted." : "";
    const label = verdict ? verdict.verdict.replace("_", " ") : "no verdict";
    const notes = `${baseNotes}\n\nRepair (${label}): ${verdict?.notes ?? "Claude didn't report on this test."}${revertNote}`;
    await db.update(schema.testCases).set({ verdict: verdict?.verdict ?? null, notes: notes.trim() }).where(eq(schema.testCases.id, target.caseId));
  }

  console.log(`Repair: ${targets.length - stillFailing} fixed, ${stillFailing} still failing`);
  if (stillFailing > 0 && envProblems === stillFailing) throw new EnvProblemError(`All ${stillFailing} remaining failures look like environment problems`);
}

async function readReport(file: string): Promise<ReportedTest[]> {
  const raw = await readFile(file, "utf8").catch(() => null);
  const parsed = raw ? playwrightReportSchema.safeParse(JSON.parse(raw)) : null;
  return parsed?.success ? flattenReport(parsed.data) : [];
}

async function rerunTests(files: string[], repairDir: string, env: Record<string, string>) {
  const reportFile = path.join(repairDir, "report.json");
  console.log(`Re-running ${files.length} repaired tests`);
  await runPlaywright(["test", "--no-deps", "--output", path.join(repairDir, "results"), "--reporter=list,json", ...files], {
    ...env,
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile
  });
  return readReport(reportFile);
}

function countExpects(source: string) {
  return source.match(/\bexpect(\.soft)?\(/g)?.length ?? 0;
}
