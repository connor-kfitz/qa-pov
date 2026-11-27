import "dotenv/config";

import path from "node:path";

import { defineConfig, type Project } from "@playwright/test";
import { authStatePath, loadAppConfigSync } from "./src/lib/app-config";

const slug = process.env.QA_APP;
if (!slug) throw new Error("QA_APP is not set (e.g. QA_APP=synergy-qmp).");

const app = loadAppConfigSync(slug);
const runDir = path.resolve(process.env.QA_RUN_DIR ?? "runs/manual");

const roleProjects: Project[] = Object.entries(app.roles).map(([role, cfg]) => ({
  name: role,
  testDir: path.join(runDir, "tests"),
  testMatch: `**/*.${role}.spec.ts`,
  use: "skip" in cfg ? {} : { storageState: authStatePath(slug, role) },
  dependencies: "skip" in cfg ? [] : ["setup"]
}));

export default defineConfig({
  outputDir: path.join(runDir, "test-results"),
  fullyParallel: true,
  retries: 1,
  reporter: [["list"], ["json", { outputFile: path.join(runDir, "report.json") }]],
  use: {
    baseURL: app.baseUrl,
    video: "on",
    screenshot: "on",
    trace: "on"
  },
  projects: [{ name: "setup", testDir: "./playwright", testMatch: "auth.setup.ts" }, ...roleProjects]
});
