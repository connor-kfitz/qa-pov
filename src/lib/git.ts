import { execFile, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import type { ResolvedRef } from "@/types/runner.types";

const run = promisify(execFile);

function git(repoPath: string, args: string[], timeout = 60_000) {
  return run("git", args, { cwd: repoPath, timeout, maxBuffer: 64 * 1024 * 1024 }).then((result) => result.stdout);
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const output = await git(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"], 5000).catch(() => "");

  const names = output
    .split(/\r?\n/)
    .map((ref) => ref.trim().replace(/^origin\//, ""))
    .filter((ref) => ref && ref !== "HEAD" && ref !== "origin");
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function fetchOrigin(repoPath: string) {
  await git(repoPath, ["fetch", "--quiet", "--prune", "origin"], 120_000);
}

async function commitOf(repoPath: string, ref: string) {
  const sha = await git(repoPath, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).catch(() => "");
  return sha.trim() || null;
}

export async function resolveRef(repoPath: string, ref: string): Promise<ResolvedRef> {
  const pr = ref.match(/^#?(\d+)$/);
  if (pr) {
    await git(repoPath, ["fetch", "--quiet", "origin", `pull/${pr[1]}/head`], 120_000);
    const sha = await commitOf(repoPath, "FETCH_HEAD");
    if (sha) return { label: `PR #${pr[1]}`, sha };
  }

  for (const candidate of [`origin/${ref}`, ref]) {
    const sha = await commitOf(repoPath, candidate);
    if (sha) return { label: ref, sha };
  }
  throw new Error(`Can't find "${ref}" in ${repoPath} (tried origin/${ref}, ${ref}${pr ? `, PR #${pr[1]}` : ""})`);
}

export async function exportSnapshot(repoPath: string, sha: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const archive = spawn("git", ["archive", "--format=tar", sha], { cwd: repoPath });
  const tar = spawn("tar", ["-xf", "-"], { cwd: dest });
  let stderr = "";
  archive.stderr.on("data", (d) => (stderr += d));
  tar.stderr.on("data", (d) => (stderr += d));
  archive.stdout.on("error", () => {});
  tar.stdin.on("error", () => {});
  archive.stdout.pipe(tar.stdin);

  const exitCode = (child: typeof archive) =>
    new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
  const codes = await Promise.all([exitCode(archive), exitCode(tar)]);
  if (codes.some((code) => code !== 0)) throw new Error(`Couldn't export ${sha.slice(0, 7)}: ${stderr.trim()}`);
}

export async function diffSummary(repoPath: string, base: string, head: string) {
  const range = `${base}...${head}`;
  const [files, stat, patch] = await Promise.all([git(repoPath, ["diff", "--name-only", range]), git(repoPath, ["diff", "--stat", range]), git(repoPath, ["diff", range])]);
  return { changedFiles: files.split(/\r?\n/).filter(Boolean), stat: stat.trimEnd(), patch }
}

export async function isAncestor(repoPath: string, ancestor: string, descendant: string) {
  return git(repoPath, ["merge-base", "--is-ancestor", ancestor, descendant]).then(
    () => true,
    () => false
  );
}

export async function diffFiles(before: string, after: string) {
  return run("git", ["diff", "--no-index", "--", before, after]).then(
    () => "",
    (err: { stdout?: string }) => err.stdout ?? ""
  );
}
