import path from "node:path";

import { spawn } from "node:child_process";

export interface ClaudeOptions {
  cwd?: string;
  withBrowser?: boolean;
  allowedTools?: string[];
}

export interface ClaudeResult {
  text: string;
  costUsd?: number;
  durationMs?: number;
}

export function runClaude(prompt: string, opts: ClaudeOptions = {}): Promise<ClaudeResult> {
  const args = ["-p", "--output-format", "json"];
  if (opts.withBrowser) args.push("--mcp-config", path.resolve("playwright-mcp.json"));
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: opts.cwd, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${stderr.trim()}`));
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

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in Claude's answer");
  return JSON.parse(body.slice(start));
}
