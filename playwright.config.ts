import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig, type Project } from "@playwright/test";
import { authStatePath, loadAppConfigSync, projectRoot } from "./src/lib/app-config";

loadEnv({ path: path.join(projectRoot, ".env"), quiet: true });

const slug = process.env.QA_APP;
if (!slug) throw new Error("QA_APP is not set (e.g. QA_APP=synergy-qmp).");

const app = loadAppConfigSync(slug);
const runDir = path.resolve(process.env.QA_RUN_DIR ?? "runs/manual");

const roleProjects: Project[] = Object.keys(app.roles).map((role) => ({
  name: role,
  testDir: path.join(runDir, "tests"),
  testMatch: `**/*.${role}.spec.ts`,
  use: { storageState: authStatePath(slug, role) },
  dependencies: ["setup"]
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
