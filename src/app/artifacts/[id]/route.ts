import path from "node:path";

import { readFile } from "node:fs/promises";
import { resolveRunPath } from "@/lib/run-files";
import { getArtifact } from "@/lib/runs";

const contentTypes: Record<string, string> = {
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
  ".log": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
}

export async function GET(request: Request, { params }: RouteContext<"/artifacts/[id]">) {
  const { id } = await params;
  const artifact = await getArtifact(id);
  const file = artifact && resolveRunPath(artifact.path);
  if (!file) return new Response("Not found", { status: 404 });

  const data = await readFile(file).catch(() => null);
  if (!data) return new Response("Artifact file is missing", { status: 404 });

  const headers = new Headers({ "Content-Type": contentTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  if (new URL(request.url).searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="${path.basename(file)}"`);
  return new Response(new Uint8Array(data), { headers });
}
