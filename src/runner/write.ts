import path from "node:path";

import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseAnswer, slugify } from "@/lib/helpers";
import { writeReportSchema } from "@/lib/plan-schema";
import { toRunRelativePath } from "@/lib/run-files";
import { runClaude } from "@/runner/claude";
import { runPlaywright } from "@/runner/playwright";
import { buildWritePrompt } from "@/runner/prompts";
import { fixtureImport, runnerEnv, sessionAllowedTools, sessionTools, verifyCommand, writeBrowserConfig } from "@/runner/session";
import type { RunContext, SpecTarget, StepInput, WriteReport } from "@/types/runner.types";

const writeTimeoutMs = 30 * 60_000;

export async function write({ run, app, runDir }: StepInput, context: RunContext | null) {
  const testsDir = path.join(runDir, "tests");
  const writeDir = path.join(runDir, "write");
  await rm(testsDir, { recursive: true, force: true });
  await mkdir(testsDir, { recursive: true });
  await mkdir(writeDir, { recursive: true });
  const env = runnerEnv(app, runDir);

  if ((await runPlaywright(["test", "--project", "setup", "--reporter=line"], env)) !== 0) throw new Error("Signing in failed; see the log above");

  const cases = await db.select().from(schema.testCases).where(eq(schema.testCases.runId, run.id)).orderBy(asc(schema.testCases.createdAt), asc(schema.testCases.title));
  if (cases.length === 0) throw new Error("No planned test cases to write");

  const targets: SpecTarget[] = cases.map((testCase, i) => ({
    caseId: testCase.id,
    file: `${String(i + 1).padStart(2, "0")}-${slugify(testCase.title).slice(0, 50)}.${testCase.role}.spec.ts`,
    title: testCase.title,
    role: testCase.role,
    kind: testCase.kind,
    steps: testCase.steps,
    expected: testCase.expected
  }));

  const codeDir = context && existsSync(context.codeDir) ? context.codeDir : null;

  for (const role of [...new Set(targets.map((target) => target.role))]) {
    const group = targets.filter((target) => target.role === role);
    const mcpConfig = await writeBrowserConfig(writeDir, app, role);
    const prompt = buildWritePrompt(run, app, role, group, codeDir ? context : null, { fixtureImport: fixtureImport(testsDir), verifyCommand: verifyCommand(role) });
    await writeFile(path.join(writeDir, `prompt-${role}.md`), prompt);

    console.log(`Writing ${group.length} ${role} tests`);
    const result = await runClaude(prompt, {
      cwd: testsDir,
      tools: sessionTools,
      allowedTools: sessionAllowedTools,
      permissionMode: "acceptEdits",
      addDirs: codeDir ? [codeDir] : [],
      mcpConfig,
      env,
      timeoutMs: writeTimeoutMs
    });
    await writeFile(path.join(writeDir, `answer-${role}.md`), result.text);
    console.log(`Wrote ${role} tests: ${Math.round((result.durationMs ?? 0) / 1000)}s, $${(result.costUsd ?? 0).toFixed(2)}`);

    await recordWritten(group, testsDir, parseAnswer(result.text, writeReportSchema));
  }

  const specs = targets.filter((target) => existsSync(path.join(testsDir, target.file))).length;
  console.log(`${specs} of ${targets.length} cases have a test file`);
  if (specs === 0) throw new Error("Claude didn't write any test files");
}

async function recordWritten(group: SpecTarget[], testsDir: string, report: WriteReport | null) {
  for (const target of group) {
    const file = path.join(testsDir, target.file);
    const entry = report?.cases.find((reported) => path.basename(reported.file) === target.file);

    if (!existsSync(file)) {
      await db.update(schema.testCases).set({ notes: entry?.note ?? "No test file was written" }).where(eq(schema.testCases.id, target.caseId));
      continue;
    }

    console.log(`${target.file}: write check ${entry?.status ?? "not reported"}`);
    await db.update(schema.testCases).set({ specPath: toRunRelativePath(file), status: "written", notes: entry?.note ?? null }).where(eq(schema.testCases.id, target.caseId));
  }
}
