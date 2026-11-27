import path from "node:path";

import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { AppConfig } from "@/types/shared.types";

export const roleSchema = z.union([
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
  repoUrl: z.url().optional(),
  repoPath: z.string(),
  compareBranch: z.string().default("develop"),
  bypassSecretEnv: z.string().optional(),
  roles: z.record(z.string(), roleSchema)
});

export const projectRoot = path.resolve(process.env.QA_ROOT ?? process.cwd());

export const appsDir = path.join(projectRoot, "qa-apps");

export async function loadAppConfig(slug: string): Promise<AppConfig> {
  const file = path.join(appsDir, `${slug}.json`);
  const raw = JSON.parse(await readFile(file, "utf8"));
  return appConfigSchema.parse(raw);
}

export async function listAppConfigs(): Promise<AppConfig[]> {
  const files = (await readdir(appsDir)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map((file) => loadAppConfig(path.basename(file, ".json"))));
}

export async function saveNewAppConfig(config: AppConfig) {
  const file = path.join(appsDir, `${config.slug}.json`);
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
}

export function loadAppConfigSync(slug: string): AppConfig {
  const file = path.join(appsDir, `${slug}.json`);
  return appConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export function bypassSecret(app: AppConfig) {
  if (!app.bypassSecretEnv) return null;
  const secret = process.env[app.bypassSecretEnv];
  if (!secret) throw new Error(`Set ${app.bypassSecretEnv} in .env`);
  return secret;
}

export function authStatePath(slug: string, role: string): string {
  return path.join(projectRoot, ".auth", slug, `${role}.json`);
}
