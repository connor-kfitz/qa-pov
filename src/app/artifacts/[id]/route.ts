import path from "node:path";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseByteRange } from "@/lib/helpers";
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

  const size = await stat(file).then((stats) => (stats.isFile() ? stats.size : null)).catch(() => null);
  if (size === null) return new Response("Artifact file is missing", { status: 404 });

  const headers = new Headers({
    "Content-Type": contentTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes"
  });
  if (new URL(request.url).searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="${path.basename(file)}"`);

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    headers.set("Content-Length", String(size));
    return new Response(streamFile(file), { headers });
  }

  const range = parseByteRange(rangeHeader, size);
  if (!range) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  return new Response(streamFile(file, range), { status: 206, headers });
}

function streamFile(file: string, range?: { start: number; end: number }) {
  return Readable.toWeb(createReadStream(file, range)) as ReadableStream<Uint8Array>;
}
