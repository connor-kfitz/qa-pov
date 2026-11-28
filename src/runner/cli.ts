import "dotenv/config";

import path from "node:path";

import { mkdir, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { upsertApp } from "@/db/apps";
import { loadAppConfig } from "@/lib/app-config";
import { runSteps } from "@/lib/helpers";
import { acquireRunLock, launchNextQueuedRun, releaseRunLock, requeueRun } from "@/lib/run-queue";
import { plan } from "@/runner/plan";
import { EnvProblemError, prepare } from "@/runner/prepare";
import { repair } from "@/runner/repair";
import { runTests } from "@/runner/run";
import { save } from "@/runner/save";
import { write } from "@/runner/write";
import type { RunContext } from "@/types/runner.types";
import type { Depth, Run, RunStatus, Scenario } from "@/types/shared.types";

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    app: { type: "string" },
    scenario: { type: "string", default: "feature" },
    depth: { type: "string", default: "base" },
    max: { type: "string" },
    feature: { type: "string" },
    compare: { type: "string" },
    from: { type: "string" }
  }
});

async function main() {
  const from = values.from as RunStatus | undefined;
  if (from && !runSteps.some((step) => step === from)) throw new Error(`--from must be one of ${runSteps.join(", ")}`);

  const lock = await acquireRunLock();
  const runId = values.run ? await queueExisting(values.run, from, lock !== null) : await createRun();

  if (!lock) {
    console.log(`Another run is in progress. Run ${runId} is queued and starts when it finishes.`);
    return;
  }

  const finish = async () => {
    await releaseRunLock(lock);
    const next = await launchNextQueuedRun();
    if (next) console.log(`Launched queued run ${next}`);
  }

  try {
    const claimed = await claimRun(runId);
    if (claimed) await execute(claimed.run, claimed.from, finish);
  } catch (err) {
    await failIfUnfinished(runId, err);
    throw err;
  } finally {
    await finish();
  }
}

async function createRun() {
  if (!values.app) throw new Error("--app is required");
  const scenario = values.scenario as Scenario;
  const depth = values.depth as Depth;
  if (!schema.scenarioEnum.enumValues.includes(scenario)) throw new Error("--scenario must be codebase or feature");
  if (!schema.depthEnum.enumValues.includes(depth)) throw new Error("--depth must be base or base_edge");
  if (scenario === "feature" && !values.feature) throw new Error("--feature <branch|PR|range> is required for a feature run");

  const app = await loadAppConfig(values.app);
  const appRow = await upsertApp(app);

  const [run] = await db
    .insert(schema.runs)
    .values({
      appId: appRow.id,
      scenario,
      depth,
      maxTests: values.max ? Number(values.max) : null,
      compareRef: values.compare ?? app.compareBranch,
      featureRef: values.feature ?? null
    })
    .returning();
  return run.id;
}

async function queueExisting(id: string, from: RunStatus | undefined, holdsLock: boolean) {
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  if (!run) throw new Error(`Run ${id} not found`);
  if (!from) {
    if (run.status !== "queued") throw new Error(`Run ${id} is ${run.status}, not queued; retry it with --from <step>`);
    return id;
  }

  const retryable: RunStatus[] = holdsLock ? schema.runStatusEnum.enumValues : ["queued", "done", "failed", "blocked"];
  if (!(await requeueRun(id, from, retryable))) throw new Error(`Run ${id} is ${run.status} in another runner; wait for it to finish`);
  return id;
}

async function claimRun(id: string) {
  const [queued] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  const from = queued?.retryFrom ?? "preparing";
  const [run] = await db
    .update(schema.runs)
    .set({ status: from, retryFrom: null })
    .where(and(eq(schema.runs.id, id), eq(schema.runs.status, "queued")))
    .returning();
  if (!run) {
    console.log(`Run ${id} is no longer queued`);
    return null;
  }
  return { run, from }
}

async function failIfUnfinished(id: string, err: unknown) {
  const [run] = await db.select({ status: schema.runs.status }).from(schema.runs).where(eq(schema.runs.id, id));
  if (!run || !runSteps.some((step) => step === run.status)) return;
  const message = err instanceof Error ? err.message : String(err);
  await db.update(schema.runs).set({ status: "failed", error: `${run.status}: ${message}`, finishedAt: new Date() }).where(eq(schema.runs.id, id));
}

async function loadContext(runDir: string): Promise<RunContext | null> {
  const saved = await readFile(path.join(runDir, "context.json"), "utf8").catch(() => null);
  return saved ? { ...JSON.parse(saved), diff: "" } : null;
}

async function execute(run: Run, from: RunStatus, onCrash: () => Promise<void>) {
  const runDir = path.resolve("runs", run.id);
  await mkdir(path.join(runDir, "tests"), { recursive: true });
  console.log(`Run ${run.id} started (${run.scenario}, ${run.depth}${from === "preparing" ? "" : `, from ${from}`}) → ${runDir}`);

  const setStatus = (status: RunStatus, error?: string) => db.update(schema.runs).set({ status, error: error ?? null }).where(eq(schema.runs.id, run.id));

  const [appRow] = await db.select().from(schema.apps).where(eq(schema.apps.id, run.appId));
  const input = { run, app: await loadAppConfig(appRow.slug), runDir }
  let context: RunContext | null = from === "preparing" ? null : await loadContext(runDir);

  const steps: [RunStatus, () => Promise<void>][] = [
    ["preparing", async () => {
      context = await prepare(input);
    }],
    ["planning", async () => plan(input, context!)],
    ["writing", async () => write(input, context)],
    ["running", async () => runTests(input)],
    ["repairing", async () => repair(input)],
    ["saving", async () => save(input)]
  ];

  const start = steps.findIndex(([status]) => status === from);
  if (start === 0) await db.update(schema.runs).set({ startedAt: new Date() }).where(eq(schema.runs.id, run.id));

  let current: RunStatus = from;
  process.on("uncaughtException", async (err) => {
    console.error(err);
    await db.update(schema.runs).set({ status: "failed", error: `${current}: ${err.message}`, finishedAt: new Date() }).where(eq(schema.runs.id, run.id)).catch(() => {});
    await onCrash().catch(() => {});
    process.exit(1);
  });

  for (const [status, step] of steps.slice(start)) {
    current = status;
    await setStatus(status);
    console.log(`${new Date().toISOString()} ${status}`);
    try {
      await step();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const finalStatus = err instanceof EnvProblemError ? "blocked" : "failed";
      await db.update(schema.runs).set({ status: finalStatus, error: `${status}: ${message}`, finishedAt: new Date() }).where(eq(schema.runs.id, run.id));
      throw err;
    }
  }

  await db.update(schema.runs).set({ status: "done", finishedAt: new Date() }).where(eq(schema.runs.id, run.id));
  console.log(`Run ${run.id} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
