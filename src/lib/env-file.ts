import path from "node:path";

import { readFile, writeFile } from "node:fs/promises";
import { projectRoot } from "@/lib/app-config";

const envPath = path.join(projectRoot, ".env");

export function envIsSet(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]));
}

export function envValues(names: string[]) {
  return Object.fromEntries(names.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])));
}

export async function updateEnvFile(updates: Record<string, string>) {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  const current = await readFile(envPath, "utf8").catch(() => "");
  const lines = current.length > 0 ? current.replace(/\r?\n$/, "").split(/\r?\n/) : [];

  for (const [name, value] of entries) {
    const line = `${name}=${quoteEnvValue(value)}`;
    const index = lines.findIndex((existing) => existing.startsWith(`${name}=`));
    if (index === -1) lines.push(line);
    else lines[index] = line;
    process.env[name] = value;
  }

  await writeFile(envPath, `${lines.join("\n")}\n`);
}

function quoteEnvValue(value: string) {
  if (/[\r\n]/.test(value)) throw new Error("Values in .env can't contain line breaks.");
  if (/^[\w@.+\-/:]*$/.test(value)) return value;
  const quote = ["'", "`", '"'].find((mark) => !value.includes(mark));
  if (!quote) throw new Error("This value uses every quote character, so it can't be stored in .env. Set it by hand.");
  return `${quote}${value}${quote}`;
}
