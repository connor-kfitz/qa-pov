import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { todo } from "@/lib/helpers";
import type { StepInput } from "@/types/runner.types";

export async function repair({ run }: StepInput) {
  const failed = await db
    .select({ id: schema.testCases.id })
    .from(schema.testCases)
    .where(and(eq(schema.testCases.runId, run.id), eq(schema.testCases.status, "failed")));

  if (failed.length === 0) {
    console.log("No failures to repair");
    return;
  }
  todo(`repair pass for ${failed.length} failed tests`);
}
