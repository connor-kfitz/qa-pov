import path from "node:path";

import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { parsePlan } from "@/lib/helpers";
import { askClaude } from "@/runner/claude";
import { buildPlanPrompt, buildPlanRetryPrompt } from "@/runner/prompts";
import type { RunContext, StepInput } from "@/types/runner.types";

const defaultMaxTests = 25;
const planTimeoutMs = 15 * 60_000;

export async function plan({ run, app, runDir }: StepInput, context: RunContext) {
  const roles = Object.keys(app.roles);
  const maxTests = run.maxTests ?? defaultMaxTests;
  const planDir = path.join(runDir, "plan");
  await mkdir(planDir, { recursive: true });

  const ask = async (prompt: string, attempt: number) => {
    await writeFile(path.join(planDir, `prompt-${attempt}.md`), prompt);
    const result = await askClaude({ runId: run.id, step: "planning", label: `Attempt ${attempt}` }, prompt, { cwd: context.codeDir, tools: ["Read", "Glob", "Grep"], timeoutMs: planTimeoutMs });
    await writeFile(path.join(planDir, `answer-${attempt}.md`), result.text);
    console.log(`Plan attempt ${attempt}: ${Math.round((result.durationMs ?? 0) / 1000)}s, $${(result.costUsd ?? 0).toFixed(2)}`);
    return parsePlan(result.text, roles, run.depth);
  }

  const prompt = buildPlanPrompt(run, app, context, maxTests);
  let parsed = await ask(prompt, 1);
  if (!parsed.ok) {
    console.log(`Plan rejected: ${parsed.error}. Retrying once.`);
    parsed = await ask(buildPlanRetryPrompt(prompt, parsed.error), 2);
  }
  if (!parsed.ok) throw new Error(`Claude's plan was invalid twice: ${parsed.error}`);

  const cases = parsed.plan.cases.slice(0, maxTests);
  if (parsed.droppedEdgeCases > 0) console.log(`Dropped ${parsed.droppedEdgeCases} edge cases (depth is base)`);
  if (parsed.plan.cases.length > maxTests) console.log(`Kept the top ${maxTests} of ${parsed.plan.cases.length} cases`);

  await writeFile(path.join(planDir, "plan.json"), `${JSON.stringify({ cases }, null, 2)}\n`);
  await db.transaction(async (tx) => {
    await tx.delete(schema.testCases).where(eq(schema.testCases.runId, run.id));
    await tx.insert(schema.testCases).values(cases.map((testCase) => ({ runId: run.id, ...testCase, status: "planned" as const })));
    await tx.update(schema.runs).set({ plan: { cases } }).where(eq(schema.runs.id, run.id));
  });
  console.log(`Planned ${cases.length} cases`);
}
