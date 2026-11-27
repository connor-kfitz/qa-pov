import path from "node:path";

import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { runLogPath } from "@/lib/run-files";

export function launchRunner(runId: string) {
  const logFile = runLogPath(runId);
  mkdirSync(path.dirname(logFile), { recursive: true });
  const log = openSync(logFile, "a");

  const tsx = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsx, "src/runner/cli.ts", "--run", runId], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true
  });
  child.unref();
}
