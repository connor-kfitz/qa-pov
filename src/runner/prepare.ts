import os from "node:os";
import path from "node:path";

import { mkdir, rm, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { bypassSecret } from "@/lib/app-config";
import { diffSummary, exportSnapshot, fetchOrigin, isAncestor, resolveRef } from "@/lib/git";
import { shortSha, truncate } from "@/lib/helpers";
import type { AppConfig } from "@/types/shared.types";
import type { RunContext, StepInput } from "@/types/runner.types";

export class EnvProblemError extends Error {}

const maxDiffChars = 60_000;

export async function prepare({ run, app, runDir }: StepInput): Promise<RunContext> {
  await checkEnv(app);

  await fetchOrigin(app.repoPath);
  const deployed = await resolveRef(app.repoPath, run.compareRef ?? app.compareBranch);
  console.log(`${deployed.label} is at ${shortSha(deployed.sha)}`);

  let head = deployed;
  let base = null;
  let diff = { changedFiles: [] as string[], stat: "", patch: "" };

  if (run.scenario === "feature") {
    const [from, to] = run.featureRef?.includes("..") ? run.featureRef.split(/\.{2,3}/) : [null, run.featureRef ?? ""];
    head = await resolveRef(app.repoPath, to);
    base = from ? await resolveRef(app.repoPath, from) : deployed;
    diff = await diffSummary(app.repoPath, base.sha, head.sha);
    console.log(`${head.label} (${shortSha(head.sha)}) changes ${diff.changedFiles.length} files vs ${base.label}`);
    if (!(await isAncestor(app.repoPath, head.sha, deployed.sha))) console.log(`Warning: ${head.label} isn't merged into ${deployed.label}, so the live env may not have it yet`);
  }

  const codeDir = path.join(os.tmpdir(), "qa-pov", run.id, "code");
  await rm(codeDir, { recursive: true, force: true });
  await exportSnapshot(app.repoPath, head.sha, codeDir);
  console.log(`Code for ${shortSha(head.sha)} exported to ${codeDir}`);

  const shown = truncate(diff.patch, maxDiffChars);
  const context: RunContext = {
    runId: run.id,
    scenario: run.scenario,
    codeDir,
    head,
    base,
    changedFiles: diff.changedFiles,
    diffStat: diff.stat,
    diff: shown.text,
    diffTruncated: shown.truncated
  }

  await mkdir(runDir, { recursive: true });
  if (diff.patch) {
    await writeFile(path.join(runDir, "diff.patch"), diff.patch);
    await writeFile(path.join(codeDir, ".qa-pov-diff.patch"), diff.patch);
  }
  await writeFile(path.join(runDir, "context.json"), `${JSON.stringify({ ...context, diff: undefined }, null, 2)}\n`);
  await db.update(schema.runs).set({ deployedCommitStart: deployed.sha }).where(eq(schema.runs.id, run.id));
  return context;
}

async function checkEnv(app: AppConfig) {
  const secret = bypassSecret(app);
  const headers: Record<string, string> = secret ? { "x-vercel-protection-bypass": secret } : {};

  const response = await fetch(app.baseUrl, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) }).catch((err: unknown) => {
    throw new EnvProblemError(`${app.baseUrl} didn't respond: ${err instanceof Error ? err.message : String(err)}`);
  });

  const location = response.headers.get("location") ?? "";
  if (/vercel\.com\/(sso-api|login)/.test(location)) throw new EnvProblemError(`Vercel Deployment Protection blocked ${app.baseUrl}; check ${app.bypassSecretEnv ?? "the app's bypassSecretEnv"}`);
  if (response.status >= 500) throw new EnvProblemError(`${app.baseUrl} returned ${response.status}`);
  console.log(`${app.baseUrl} is up (${response.status})`);
}
