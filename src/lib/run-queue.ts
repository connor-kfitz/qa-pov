import { Client } from "pg";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { runSteps } from "@/lib/helpers";
import { launchRunner } from "@/lib/launch-runner";
import type { RunStatus } from "@/types/shared.types";

const runLockKey = 7_301_442;

export async function acquireRunLock() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ locked: boolean }>("select pg_try_advisory_lock($1) as locked", [runLockKey]);
  if (rows[0].locked) return client;
  await client.end();
  return null;
}

export async function releaseRunLock(lock: Client) {
  await lock.end();
}

export async function requeueRun(id: string, from: RunStatus, onlyIf: RunStatus[]) {
  const updated = await db
    .update(schema.runs)
    .set({ status: "queued", retryFrom: from, error: null, finishedAt: null, queuedAt: new Date() })
    .where(and(eq(schema.runs.id, id), inArray(schema.runs.status, onlyIf)))
    .returning({ id: schema.runs.id });
  return updated.length > 0;
}

export async function markRunCancelled(id: string) {
  const [cancelled] = await db
    .update(schema.runs)
    .set({ status: "cancelled", error: sql`${schema.runs.status}::text || ': Cancelled from the dashboard'`, finishedAt: new Date() })
    .where(and(eq(schema.runs.id, id), inArray(schema.runs.status, ["queued", ...runSteps])))
    .returning({ error: schema.runs.error });
  return cancelled ? { wasRunning: !cancelled.error?.startsWith("queued:") } : null;
}

export async function launchNextQueuedRun() {
  const [next] = await db.select({ id: schema.runs.id }).from(schema.runs).where(eq(schema.runs.status, "queued")).orderBy(asc(schema.runs.queuedAt)).limit(1);
  if (next) launchRunner(next.id);
  return next?.id ?? null;
}
