import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function listBranches(repoPath: string): Promise<string[]> {
  const output = await run("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"], { cwd: repoPath, timeout: 5000 })
    .then((result) => result.stdout)
    .catch(() => "");

  const names = output
    .split(/\r?\n/)
    .map((ref) => ref.trim().replace(/^origin\//, ""))
    .filter((ref) => ref && ref !== "HEAD" && ref !== "origin");
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
