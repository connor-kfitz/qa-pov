import "dotenv/config";

import path from "node:path";

import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadAppConfig, type AppConfig } from "@/lib/app-config";

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    scenario: { type: "string", default: "feature" },
    depth: { type: "string", default: "base" },
    max: { type: "string" },
    feature: { type: "string" },
    compare: { type: "string" }
  }
});

type Scenario = (typeof schema.scenarioEnum.enumValues)[number];
type Depth = (typeof schema.depthEnum.enumValues)[number];
type RunStatus = (typeof schema.runStatusEnum.enumValues)[number];

async function main() {
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

  const runDir = path.resolve("runs", run.id);
  await mkdir(path.join(runDir, "tests"), { recursive: true });
  console.log(`Run ${run.id} created (${scenario}, ${depth}) → ${runDir}`);

  const setStatus = (status: RunStatus, error?: string) => db.update(schema.runs).set({ status, error: error ?? null }).where(eq(schema.runs.id, run.id));

  const steps: [RunStatus, () => Promise<void>][] = [
    ["preparing", async () => todo("check env is up, record deployed commit, compute diff")],
    ["planning", async () => todo("claude -p → test plan JSON, validate with testPlanSchema")],
    ["writing", async () => todo("claude -p + Playwright MCP → one spec per case in runs/<id>/tests")],
    ["running", async () => todo("npx playwright test with QA_APP and QA_RUN_DIR set")],
    ["repairing", async () => todo("one bounded repair pass on failures")],
    ["saving", async () => todo("write cases, verdicts and artifact paths to Postgres")]
  ];

  await db.update(schema.runs).set({ startedAt: new Date() }).where(eq(schema.runs.id, run.id));

  for (const [status, step] of steps) {
    await setStatus(status);
    try {
      await step();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setStatus("failed", `${status}: ${message}`);
      throw err;
    }
  }

  await db.update(schema.runs).set({ status: "done", finishedAt: new Date() }).where(eq(schema.runs.id, run.id));
  console.log(`Run ${run.id} done`);
}

async function upsertApp(app: AppConfig) {
  const [row] = await db
    .insert(schema.apps)
    .values({ slug: app.slug, name: app.name, baseUrl: app.baseUrl, repoPath: app.repoPath })
    .onConflictDoUpdate({ target: schema.apps.slug, set: { name: app.name, baseUrl: app.baseUrl, repoPath: app.repoPath } })
    .returning();
  return row;
}

function todo(what: string): never {
  throw new Error(`not implemented yet: ${what}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
