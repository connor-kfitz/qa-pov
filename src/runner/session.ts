import path from "node:path";

import { writeFile } from "node:fs/promises";
import { authStatePath } from "@/lib/app-config";
import { toPosix } from "@/lib/helpers";
import type { AppConfig } from "@/types/shared.types";

const mcpVersion = "0.0.86";

export const sessionTools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
export const sessionAllowedTools = ["mcp__playwright", "Bash(npx playwright test:*)"];

export function runnerEnv(app: AppConfig, runDir: string) {
  return { QA_APP: app.slug, QA_RUN_DIR: runDir, QA_ROOT: process.cwd() }
}

export async function writeBrowserConfig(dir: string, app: AppConfig, role: string) {
  const file = path.join(dir, `mcp-${role}.json`);
  const args = ["-y", `@playwright/mcp@${mcpVersion}`, "--headless", "--isolated", "--storage-state", authStatePath(app.slug, role), "--output-dir", path.join(dir, `browser-${role}`)];
  const server = process.platform === "win32" ? { command: "cmd", args: ["/c", "npx", ...args] } : { command: "npx", args };
  await writeFile(file, JSON.stringify({ mcpServers: { playwright: server } }, null, 2));
  return file;
}

export function verifyCommand(role: string, outputDir?: string) {
  const command = `npx playwright test -c ${toPosix(path.resolve("playwright.config.ts"))} --project ${role} --no-deps --reporter=list`;
  return outputDir ? `${command} --output ${toPosix(outputDir)}` : command;
}

export function fixtureImport(testsDir: string) {
  return toPosix(path.relative(testsDir, path.resolve("playwright", "fixtures")));
}
