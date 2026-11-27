import "dotenv/config";

import path from "node:path";

import { mkdir, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { upsertApp } from "@/db/apps";
import { loadAppConfig } from "@/lib/app-config";
import { todo } from "@/lib/helpers";
import { plan } from "@/runner/plan";
import { EnvProblemError, prepare } from "@/runner/prepare";
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
  const run = values.run ? await claimRun(values.run) : await createRun();
  await execute(run, (values.from as RunStatus | undefined) ?? "preparing");
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
  return run;
}

async function claimRun(id: string) {
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  if (!run) throw new Error(`Run ${id} not found`);
  if (values.from) {
    await db.update(schema.runs).set({ error: null, finishedAt: null }).where(eq(schema.runs.id, id));
    return run;
  }
  if (run.status !== "queued") throw new Error(`Run ${id} is ${run.status}, not queued; resume it with --from <step>`);
  return run;
}

async function loadContext(runDir: string): Promise<RunContext | null> {
  const saved = await readFile(path.join(runDir, "context.json"), "utf8").catch(() => null);
  return saved ? { ...JSON.parse(saved), diff: "" } : null;
}

async function execute(run: Run, from: RunStatus) {
  const runDir = path.resolve("runs", run.id);
  await mkdir(path.join(runDir, "tests"), { recursive: true });
  console.log(`Run ${run.id} started (${run.scenario}, ${run.depth}) → ${runDir}`);

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
    ["running", async () => todo("npx playwright test with QA_APP and QA_RUN_DIR set")],
    ["repairing", async () => todo("one bounded repair pass on failures")],
    ["saving", async () => todo("write cases, verdicts and artifact paths to Postgres")]
  ];

  const start = steps.findIndex(([status]) => status === from);
  if (start === -1) throw new Error(`--from must be one of ${steps.map(([status]) => status).join(", ")}`);
  if (start === 0) await db.update(schema.runs).set({ startedAt: new Date() }).where(eq(schema.runs.id, run.id));

  for (const [status, step] of steps.slice(start)) {
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
