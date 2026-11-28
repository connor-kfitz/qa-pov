import { asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { emptyCounts, runSteps } from "@/lib/helpers";
import type { CaseCounts } from "@/types/shared.types";

const idSchema = z.uuid();

export async function listRuns() {
  const rows = await db
    .select({ run: schema.runs, app: schema.apps })
    .from(schema.runs)
    .innerJoin(schema.apps, eq(schema.runs.appId, schema.apps.id))
    .orderBy(desc(schema.runs.createdAt))
    .limit(100);

  const counts = await countCases(rows.map((row) => row.run.id));
  return rows.map((row) => ({ ...row, counts: counts.get(row.run.id) ?? emptyCounts() }));
}

export async function getRun(id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const [row] = await db
    .select({ run: schema.runs, app: schema.apps })
    .from(schema.runs)
    .innerJoin(schema.apps, eq(schema.runs.appId, schema.apps.id))
    .where(eq(schema.runs.id, id));
  return row ?? null;
}

export async function getActiveRun() {
  const [row] = await db
    .select({ run: schema.runs, app: schema.apps })
    .from(schema.runs)
    .innerJoin(schema.apps, eq(schema.runs.appId, schema.apps.id))
    .where(inArray(schema.runs.status, [...runSteps]))
    .orderBy(sql`${schema.runs.startedAt} desc nulls last`)
    .limit(1);
  return row ?? null;
}

export function listCases(runId: string) {
  return db.select().from(schema.testCases).where(eq(schema.testCases.runId, runId)).orderBy(asc(schema.testCases.createdAt), asc(schema.testCases.title));
}

export function listClaudeCalls(runId: string) {
  return db.select().from(schema.claudeCalls).where(eq(schema.claudeCalls.runId, runId)).orderBy(asc(schema.claudeCalls.createdAt));
}

export async function getCase(runId: string, caseId: string) {
  if (!idSchema.safeParse(caseId).success) return null;
  const [testCase] = await db.select().from(schema.testCases).where(eq(schema.testCases.id, caseId));
  if (!testCase || testCase.runId !== runId) return null;
  const artifacts = await db.select().from(schema.artifacts).where(eq(schema.artifacts.testCaseId, caseId)).orderBy(asc(schema.artifacts.createdAt));
  return { testCase, artifacts };
}

export async function getArtifact(id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const [artifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, id));
  return artifact ?? null;
}

async function countCases(runIds: string[]) {
  const counts = new Map<string, CaseCounts>();
  if (runIds.length === 0) return counts;

  const rows = await db
    .select({ runId: schema.testCases.runId, status: schema.testCases.status, total: count() })
    .from(schema.testCases)
    .where(inArray(schema.testCases.runId, runIds))
    .groupBy(schema.testCases.runId, schema.testCases.status);

  for (const row of rows) {
    const runCounts = counts.get(row.runId) ?? emptyCounts();
    runCounts[row.status] = row.total;
    counts.set(row.runId, runCounts);
  }
  return counts;
}
