import { spawn, spawnSync } from "node:child_process";
import { db, schema } from "@/db";
import type { ClaudeCallTag, ClaudeOptions, ClaudeResult, ClaudeUsage } from "@/types/runner.types";

export class ClaudeError extends Error {
  constructor(message: string, readonly usage: ClaudeUsage) {
    super(message);
  }
}

export async function askClaude(tag: ClaudeCallTag, prompt: string, opts: ClaudeOptions = {}) {
  try {
    const result = await runClaude(prompt, opts);
    await recordCall(tag, true, result);
    return result;
  } catch (err) {
    await recordCall(tag, false, err instanceof ClaudeError ? err.usage : {});
    throw err;
  }
}

async function recordCall({ runId, step, label }: ClaudeCallTag, ok: boolean, usage: ClaudeUsage) {
  await db.insert(schema.claudeCalls).values({
    runId,
    step,
    label,
    ok,
    costUsd: usage.costUsd ?? null,
    durationMs: usage.durationMs ?? null,
    turns: usage.turns ?? null
  });
}

function runClaude(prompt: string, opts: ClaudeOptions = {}): Promise<ClaudeResult> {
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
      if (timedOut) return reject(new ClaudeError(`claude timed out after ${Math.round((opts.timeoutMs ?? 0) / 1000)}s`, { durationMs: opts.timeoutMs }));
      const out = parseOutput(stdout);
      const usage: ClaudeUsage = out ? { costUsd: out.total_cost_usd, durationMs: out.duration_ms, turns: out.num_turns } : {};
      if (code !== 0) return reject(new ClaudeError(`claude exited ${code}: ${stderr.trim() || stdout.slice(0, 500)}`, usage));
      if (!out) return reject(new ClaudeError(`Could not parse claude output: ${stdout.slice(0, 500)}`, usage));
      if (out.is_error) return reject(new ClaudeError(String(out.result), usage));
      resolve({ text: String(out.result ?? ""), ...usage });
    });
    child.stdin.end(prompt);
  });
}

function parseOutput(stdout: string) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"]);
  else process.kill(pid, "SIGTERM");
}
