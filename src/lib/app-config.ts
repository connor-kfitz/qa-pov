import path from "node:path";

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const roleSchema = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({
    loginUrl: z.string(),
    emailEnv: z.string(),
    passwordEnv: z.string(),
    selectors: z.object({ email: z.string().optional(), password: z.string().optional(), submit: z.string().optional() }).optional()
  })
]);

export const appConfigSchema = z.object({
  slug: z.string(),
  name: z.string(),
  baseUrl: z.url(),
  repoPath: z.string(),
  compareBranch: z.string().default("develop"),
  roles: z.record(z.string(), roleSchema)
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type RoleConfig = z.infer<typeof roleSchema>;

export const appsDir = path.resolve(process.cwd(), "qa-apps");

export async function loadAppConfig(slug: string): Promise<AppConfig> {
  const file = path.join(appsDir, `${slug}.json`);
  const raw = JSON.parse(await readFile(file, "utf8"));
  return appConfigSchema.parse(raw);
}

export function loadAppConfigSync(slug: string): AppConfig {
  const file = path.join(appsDir, `${slug}.json`);
  return appConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export function authStatePath(slug: string, role: string): string {
  return path.resolve(process.cwd(), ".auth", slug, `${role}.json`);
}
