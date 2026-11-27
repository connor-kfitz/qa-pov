import "dotenv/config";

import path from "node:path";

import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { chromium, type Browser } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { upsertApp } from "@/db/apps";
import { runDir, runLogPath, toRunRelativePath } from "@/lib/run-files";
import { escapeHtml, slugify } from "@/lib/helpers";
import type { SeedCase, SeedRun } from "@/types/dashboard.types";

const demoApp = {
  slug: "demo",
  name: "Demo app",
  baseUrl: "https://develop.demo.example.com",
  repoPath: "C:/demo/repo",
  compareBranch: "develop",
  roles: {}
}

const seedRuns: SeedRun[] = [
  {
    scenario: "feature",
    depth: "base_edge",
    featureRef: "feature/bulk-user-import",
    compareRef: "develop",
    maxTests: 5,
    status: "writing",
    commits: ["a0282db4e1", "a0282db4e1"],
    startedMinutesAgo: 2,
    log: ["preparing: develop is up, deployed commit a0282db", "preparing: diff vs develop touches 6 files", "planning: 5 cases (3 base, 2 edge)", "writing: 2 of 5 specs written"],
    cases: [
      { title: "Admin uploads a CSV and sees each imported user", role: "admin", kind: "base", steps: ["Open Users", "Click Import", "Upload a 3-row CSV", "Confirm the import"], expected: "Three new users appear in the list with the imported emails.", status: "written" },
      { title: "Imported users can sign in after setting a password", role: "admin", kind: "base", steps: ["Import one user", "Open the welcome link", "Set a password", "Sign in"], expected: "The new user lands on the student dashboard.", status: "written" },
      { title: "Import shows the row number of a malformed email", role: "admin", kind: "edge", steps: ["Upload a CSV with a bad email on row 2"], expected: "An error names row 2 and no users are created.", status: "planned" },
      { title: "Import rejects a file over the size limit", role: "admin", kind: "edge", steps: ["Upload a 6 MB CSV"], expected: "A clear size-limit error; nothing is imported.", status: "planned" },
      { title: "Students cannot open the import page", role: "student", kind: "base", steps: ["Go to /admin/users/import as a student"], expected: "The student is redirected away with no import form shown.", status: "planned" }
    ]
  },
  {
    scenario: "feature",
    depth: "base",
    featureRef: "feature/rating-only-reviews",
    compareRef: "develop",
    maxTests: 5,
    status: "done",
    commits: ["2a738cb91f", "2a738cb91f"],
    startedMinutesAgo: 55,
    durationMinutes: 7,
    withArtifacts: true,
    log: ["preparing: develop is up, deployed commit 2a738cb", "planning: 5 base cases", "writing: 5 specs written and run once", "running: 3 passed, 1 failed, 1 flaky", "repairing: 1 failure judged app bug, kept", "saving: done"],
    cases: [
      { title: "Admin can publish a review with only a star rating", role: "admin", kind: "base", steps: ["Open a course's reviews", "Click Add review", "Pick 4 stars and leave the comment empty", "Click Publish review"], expected: "The review is published with no validation error.", status: "passed", durationMs: 8400 },
      { title: "Students see rating-only reviews on the course page", role: "student", kind: "base", steps: ["Open the course page", "Scroll to Reviews"], expected: "The rating-only review shows its stars.", status: "passed", durationMs: 5200 },
      { title: "Rating-only reviews show a 'No comment' placeholder", role: "student", kind: "base", steps: ["Open the course page", "Find the rating-only review"], expected: "The card shows 'No comment' where the text would be.", status: "failed", verdict: "app_bug", notes: "The card renders an empty quote block instead of the placeholder. The page loaded normally and the selector matched the review card, so the test is right and the app is wrong.", durationMs: 6100 },
      { title: "Reviews with a rating and a comment still publish", role: "admin", kind: "base", steps: ["Click Add review", "Pick 5 stars and write a comment", "Click Publish review"], expected: "The review shows both the stars and the comment.", status: "flaky", notes: "Passed on retry. The first attempt timed out waiting for the success toast, which appeared after 5.2s. Worth watching; not a feature bug.", durationMs: 14800 },
      { title: "The course's average rating updates after a new review", role: "admin", kind: "base", steps: ["Note the average rating", "Publish a 1-star rating-only review", "Reload the course page"], expected: "The average rating goes down.", status: "passed", durationMs: 9700 }
    ]
  },
  {
    scenario: "codebase",
    compareRef: "develop",
    depth: "base",
    maxTests: 6,
    status: "blocked",
    error: "running: develop returned 502 on /login for 40s, so the remaining tests could not run. Marked as an env problem, not a failure.",
    commits: ["491818d0aa", "2a738cb91f"],
    startedMinutesAgo: 180,
    durationMinutes: 12,
    log: ["preparing: develop is up, deployed commit 491818d", "planning: 6 cases from 14 routes", "writing: 6 specs written", "running: /login returned 502 for 40s", "running: deployed commit is now 2a738cb (changed mid-run)", "blocked: env problem"],
    cases: [
      { title: "Admin can sign in and reach the dashboard", role: "admin", kind: "base", steps: ["Open /login", "Sign in as admin"], expected: "The admin dashboard loads.", status: "passed", durationMs: 4100 },
      { title: "Student can open an enrolled course", role: "student", kind: "base", steps: ["Open My courses", "Open the first course"], expected: "The course outline loads.", status: "passed", durationMs: 5600 },
      { title: "Admin can create a course", role: "admin", kind: "base", steps: ["Open Courses", "Click New course", "Fill in the title", "Save"], expected: "The course appears in the list.", status: "passed", durationMs: 7300 },
      { title: "Student can download a certificate", role: "student", kind: "base", steps: ["Open Certificates", "Click Download on a completed course"], expected: "A PDF downloads.", status: "failed", verdict: "env_problem", notes: "The request returned 502 from the env, during the same window as the login outage. Nothing here points at the app code.", durationMs: 30200 },
      { title: "Admin can send a welcome email", role: "admin", kind: "base", steps: ["Open a user", "Click Resend welcome email"], expected: "A success message shows.", status: "skipped" },
      { title: "Student can update their profile", role: "student", kind: "base", steps: ["Open Profile", "Change the display name", "Save"], expected: "The new name shows in the header.", status: "skipped" }
    ]
  },
  {
    scenario: "feature",
    depth: "base",
    featureRef: "fix/certificate-dates",
    compareRef: "develop",
    status: "failed",
    error: "planning: Claude's test plan did not match the schema: cases[2].steps must have at least 1 item",
    commits: ["491818d0aa", "491818d0aa"],
    startedMinutesAgo: 60 * 26,
    durationMinutes: 1,
    log: ["preparing: develop is up, deployed commit 491818d", "planning: Claude answered in 38s", "planning: plan failed validation: cases[2].steps must have at least 1 item"],
    cases: []
  }
];

async function main() {
  const app = await upsertApp(demoApp);

  const oldRuns = await db.select({ id: schema.runs.id }).from(schema.runs).where(eq(schema.runs.appId, app.id));
  await Promise.all(oldRuns.map((run) => rm(runDir(run.id), { recursive: true, force: true })));
  await db.delete(schema.runs).where(eq(schema.runs.appId, app.id));

  const browser = await chromium.launch().catch((err) => {
    console.warn(`Skipping screenshots, video and traces: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    return null;
  });

  try {
    for (const seedRun of seedRuns) await seedOne(app.id, seedRun, browser);
  } finally {
    await browser?.close();
  }

  console.log(`Seeded ${seedRuns.length} demo runs for "${demoApp.name}". Re-run to reset them.`);
}

async function seedOne(appId: string, seed: SeedRun, browser: Browser | null) {
  const startedAt = new Date(Date.now() - seed.startedMinutesAgo * 60_000);
  const finishedAt = seed.durationMinutes ? new Date(startedAt.getTime() + seed.durationMinutes * 60_000) : null;

  const [run] = await db
    .insert(schema.runs)
    .values({
      appId,
      scenario: seed.scenario,
      depth: seed.depth,
      maxTests: seed.maxTests ?? null,
      compareRef: seed.compareRef ?? null,
      featureRef: seed.featureRef ?? null,
      status: seed.status,
      error: seed.error ?? null,
      deployedCommitStart: seed.commits?.[0] ?? null,
      deployedCommitEnd: finishedAt ? (seed.commits?.[1] ?? null) : null,
      envChanged: seed.commits ? seed.commits[0] !== seed.commits[1] : false,
      createdAt: startedAt,
      startedAt,
      finishedAt
    })
    .returning();

  const testsDir = path.join(runDir(run.id), "tests");
  await mkdir(testsDir, { recursive: true });
  await writeFile(runLogPath(run.id), seed.log.map((line, i) => `${new Date(startedAt.getTime() + i * 20_000).toISOString()} ${line}`).join("\n") + "\n");

  for (const [i, seedCase] of seed.cases.entries()) {
    const specFile = path.join(testsDir, `${slugify(seedCase.title)}.${seedCase.role}.spec.ts`);
    if (seedCase.status !== "planned") await writeFile(specFile, demoSpec(seedCase));

    const [testCase] = await db
      .insert(schema.testCases)
      .values({
        runId: run.id,
        title: seedCase.title,
        role: seedCase.role,
        kind: seedCase.kind,
        steps: seedCase.steps,
        expected: seedCase.expected,
        specPath: seedCase.status === "planned" ? null : toRunRelativePath(specFile),
        status: seedCase.status,
        verdict: seedCase.verdict ?? null,
        notes: seedCase.notes ?? null,
        durationMs: seedCase.durationMs ?? null,
        createdAt: new Date(startedAt.getTime() + i * 1000)
      })
      .returning();

    if (browser && seed.withArtifacts) {
      const caseDir = path.join(runDir(run.id), "test-results", slugify(seedCase.title));
      const files = await captureArtifacts(browser, caseDir, seedCase);
      await db.insert(schema.artifacts).values(files.map((file) => ({ runId: run.id, testCaseId: testCase.id, type: file.type, path: toRunRelativePath(file.path) })));
    }
  }
}

async function captureArtifacts(browser: Browser, dir: string, seedCase: SeedCase) {
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 600 }, recordVideo: { dir, size: { width: 1000, height: 600 } } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  await page.setContent(demoPage(seedCase));
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Publish review" }).click();
  await page.waitForTimeout(900);

  const screenshot = path.join(dir, "test-finished-1.png");
  const trace = path.join(dir, "trace.zip");
  await page.screenshot({ path: screenshot });
  await context.tracing.stop({ path: trace });

  const video = page.video();
  await context.close();
  const videoFile = path.join(dir, "video.webm");
  if (video) await rename(await video.path(), videoFile);

  return [
    ...(video ? [{ type: "video" as const, path: videoFile }] : []),
    { type: "screenshot" as const, path: screenshot },
    { type: "trace" as const, path: trace }
  ];
}

function demoPage(seedCase: SeedCase) {
  const failed = seedCase.status === "failed";
  const result = failed ? "Expected “No comment”, found an empty quote block" : "Review published";
  const color = failed ? "#dc2626" : "#16a34a";
  return `<!doctype html><html><body style="font-family:system-ui;margin:48px;color:#18181b">
<p style="color:#71717a;font-size:14px">develop.demo.example.com · signed in as ${seedCase.role}</p>
<h1 style="font-size:24px">${escapeHtml(seedCase.title)}</h1>
<label>Rating <select><option>4 stars</option></select></label>
<button style="margin-left:12px;padding:6px 14px" onclick="document.getElementById('out').hidden=false">Publish review</button>
<div id="out" hidden style="margin-top:24px;padding:12px 16px;border:2px solid ${color};border-radius:8px;color:${color}">${result}</div>
</body></html>`;
}

function demoSpec(seedCase: SeedCase) {
  const steps = seedCase.steps.map((step) => `  await test.step(${JSON.stringify(step)}, async () => {\n    await page.waitForLoadState();\n  });`).join("\n\n");
  return `import { expect, test } from "@playwright/test";

test(${JSON.stringify(seedCase.title)}, async ({ page }) => {
  await page.goto("/");

${steps}

  await expect(page.getByText(${JSON.stringify(seedCase.expected)})).toBeVisible();
});
`;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
