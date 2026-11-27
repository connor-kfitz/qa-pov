import { spawn, spawnSync } from "node:child_process";
import type { ClaudeOptions, ClaudeResult } from "@/types/runner.types";

export function runClaude(prompt: string, opts: ClaudeOptions = {}): Promise<ClaudeResult> {
  const args = ["-p", "--output-format", "json", "--setting-sources", "project", "--disable-slash-commands", "--no-session-persistence", "--strict-mcp-config"];
  if (opts.mcpConfig) args.push("--mcp-config", opts.mcpConfig);
  if (opts.permissionMode) args.push("--permission-mode", opts.permissionMode);
  for (const dir of opts.addDirs ?? []) args.push("--add-dir", dir);
  if (opts.tools) args.push("--tools", opts.tools.join(","));
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: opts.cwd, env: { ...process.env, ...opts.env } });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killTree(child.pid);
        }, opts.timeoutMs)
      : null;

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) return reject(new Error(`claude timed out after ${Math.round((opts.timeoutMs ?? 0) / 1000)}s`));
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${stderr.trim() || stdout.slice(0, 500)}`));
      try {
        const out = JSON.parse(stdout);
        if (out.is_error) return reject(new Error(String(out.result)));
        resolve({ text: String(out.result ?? ""), costUsd: out.total_cost_usd, durationMs: out.duration_ms });
      } catch {
        reject(new Error(`Could not parse claude output: ${stdout.slice(0, 500)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"]);
  else process.kill(pid, "SIGTERM");
}
