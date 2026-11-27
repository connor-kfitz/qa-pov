import path from "node:path";

import { spawn } from "node:child_process";

const cli = path.resolve("node_modules", "@playwright", "test", "cli.js");

export function runPlaywright(args: string[], env: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
