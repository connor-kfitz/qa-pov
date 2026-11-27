import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchOrigin, resolveRef } from "@/lib/git";
import { shortSha } from "@/lib/helpers";
import type { StepInput } from "@/types/runner.types";

export async function save({ run, app }: StepInput) {
  await fetchOrigin(app.repoPath);
  const end = await resolveRef(app.repoPath, run.compareRef ?? app.compareBranch);
  const [current] = await db.select({ start: schema.runs.deployedCommitStart }).from(schema.runs).where(eq(schema.runs.id, run.id));
  const envChanged = current.start !== null && current.start !== end.sha;

  await db.update(schema.runs).set({ deployedCommitEnd: end.sha, envChanged }).where(eq(schema.runs.id, run.id));
  console.log(envChanged ? `${end.label} moved from ${shortSha(current.start!)} to ${shortSha(end.sha)} during the run` : `${end.label} stayed at ${shortSha(end.sha)}`);
}
