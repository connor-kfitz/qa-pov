import { spawnSync, type ChildProcess } from "node:child_process";

const running = new Set<ChildProcess>();

export function trackChild<T extends ChildProcess>(child: T) {
  running.add(child);
  child.on("close", () => running.delete(child));
  return child;
}

export function killChildren() {
  for (const child of running) killTree(child.pid);
  running.clear();
}

export function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"]);
  else process.kill(pid, "SIGTERM");
}
