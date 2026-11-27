import { count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { listAppConfigs, loadAppConfig } from "@/lib/app-config";
import type { Project, ProjectRun } from "@/types/dashboard.types";

export async function listProjects(): Promise<Project[]> {
  const [configs, apps, latestRuns, runCounts] = await Promise.all([
    listAppConfigs(),
    db.select().from(schema.apps),
    db.selectDistinctOn([schema.runs.appId]).from(schema.runs).orderBy(schema.runs.appId, desc(schema.runs.createdAt)),
    db.select({ appId: schema.runs.appId, total: count() }).from(schema.runs).groupBy(schema.runs.appId)
  ]);

  const projects = new Map<string, Project>();
  for (const config of configs) {
    projects.set(config.slug, { slug: config.slug, name: config.name, baseUrl: config.baseUrl, roles: Object.keys(config.roles), app: null, runCount: 0, latestRun: null });
  }
  for (const app of apps) {
    const existing = projects.get(app.slug);
    projects.set(app.slug, {
      slug: app.slug,
      name: existing?.name ?? app.name,
      baseUrl: existing?.baseUrl ?? app.baseUrl,
      roles: existing?.roles ?? [],
      app,
      runCount: runCounts.find((row) => row.appId === app.id)?.total ?? 0,
      latestRun: latestRuns.find((run) => run.appId === app.id) ?? null
    });
  }

  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProject(slug: string) {
  const [config, [app]] = await Promise.all([loadAppConfig(slug).catch(() => null), db.select().from(schema.apps).where(eq(schema.apps.slug, slug))]);
  if (!config && !app) return null;
  return {
    slug,
    name: config?.name ?? app.name,
    baseUrl: config?.baseUrl ?? app.baseUrl,
    roles: config ? Object.keys(config.roles) : [],
    configured: config !== null,
    app: app ?? null
  }
}

export async function listProjectRuns(appId: string): Promise<ProjectRun[]> {
  const runs = await db.select().from(schema.runs).where(eq(schema.runs.appId, appId)).orderBy(desc(schema.runs.createdAt));
  if (runs.length === 0) return [];

  const cases = await db
    .select()
    .from(schema.testCases)
    .where(
      inArray(
        schema.testCases.runId,
        runs.map((run) => run.id)
      )
    )
    .orderBy(schema.testCases.createdAt, schema.testCases.title);

  return runs.map((run) => ({ run, cases: cases.filter((testCase) => testCase.runId === run.id) }));
}
