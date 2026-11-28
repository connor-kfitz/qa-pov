import os from "node:os";
import path from "node:path";

import { readFile } from "node:fs/promises";
import { stripAnsi } from "@/lib/helpers";

export const runsDir = path.resolve(process.cwd(), "runs");

export function runDir(runId: string) {
  return path.join(runsDir, runId);
}

export function runLogPath(runId: string) {
  return path.join(runDir(runId), "runner.log");
}

export function snapshotDir(runId: string) {
  return path.join(os.tmpdir(), "qa-pov", runId);
}

export function repairDiffPath(runId: string, specFile: string) {
  return path.join(runDir(runId), "repair", `${specFile}.diff`);
}

export function toRunRelativePath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}

export function resolveRunPath(storedPath: string) {
  const absolute = path.resolve(process.cwd(), storedPath);
  return absolute.startsWith(runsDir + path.sep) ? absolute : null;
}

export async function readRunFile(storedPath: string) {
  const absolute = resolveRunPath(storedPath);
  if (!absolute) return null;
  return readFile(absolute, "utf8").catch(() => null);
}

export async function readRunLog(runId: string, maxLines = 300) {
  const log = await readFile(runLogPath(runId), "utf8").catch(() => null);
  if (log === null) return null;
  const lines = stripAnsi(log).trimEnd().split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}
