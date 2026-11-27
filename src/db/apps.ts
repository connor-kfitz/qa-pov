import { db, schema } from "@/db";

import type { AppConfig } from "@/types/shared.types";

export async function upsertApp(app: AppConfig) {
  const [row] = await db
    .insert(schema.apps)
    .values({ slug: app.slug, name: app.name, baseUrl: app.baseUrl, repoPath: app.repoPath })
    .onConflictDoUpdate({ target: schema.apps.slug, set: { name: app.name, baseUrl: app.baseUrl, repoPath: app.repoPath } })
    .returning();
  return row;
}
