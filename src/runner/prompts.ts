import { shortId, shortSha } from "@/lib/helpers";
import type { RunContext, SpecTarget } from "@/types/runner.types";
import type { AppConfig, Run } from "@/types/shared.types";

export function buildPlanPrompt(run: Run, app: AppConfig, context: RunContext, maxTests: number) {
  const roles = Object.entries(app.roles).map(([name, role]) => ("skip" in role ? `- ${name}: not signed in (public pages only)` : `- ${name}: signed in as a ${name} user`));
  const allowedKinds = run.depth === "base" ? '"base" only' : '"base" and "edge"';

  const scope =
    context.scenario === "feature"
      ? [
          `## What to test: one feature`,
          ``,
          `The feature is ${context.head.label} (${shortSha(context.head.sha)}), compared with ${context.base?.label} (${shortSha(context.base?.sha ?? "")}).`,
          `Plan tests for what this change does for users, plus the flows it could break. Don't plan tests for code the diff doesn't touch.`,
          ``,
          `Changed files:`,
          context.diffStat,
          ``,
          `Diff${context.diffTruncated ? " (truncated; the full diff is in .qa-pov-diff.patch)" : ""}:`,
          "```diff",
          context.diff,
          "```"
        ]
      : [
          `## What to test: the whole app on ${context.head.label}`,
          ``,
          `Find the user-facing pages and flows in the code (routes, pages, forms, actions).`,
          `Prioritise: signing in and the core flows each role relies on first, then secondary pages. Cover each role.`
        ];

  return [
    `You are planning end-to-end browser tests for a deployed web app. You only plan; another step writes and runs the tests.`,
    ``,
    `## The app`,
    ``,
    `- Name: ${app.name}`,
    `- Live URL: ${app.baseUrl} (a shared dev environment, deployed from ${run.compareRef ?? app.compareBranch})`,
    `- The code for ${context.head.label} at ${shortSha(context.head.sha)} is in the current directory. Read whatever you need with Read, Glob and Grep before planning.`,
    ``,
    `Roles (each test runs as exactly one; the session is already signed in, so never plan a login step):`,
    ...roles,
    ``,
    ...scope,
    ``,
    `## Depth`,
    ``,
    run.depth === "base"
      ? `Base cases only: the main path each feature is meant to support.`
      : `Base cases (the main path each feature supports) plus edge cases: invalid input, empty states, permissions (a role that must not see or do something), and error handling.`,
    ``,
    `## Safety rules (the environment is shared and sends real email)`,
    ``,
    `- Never submit the contact form.`,
    `- Never trigger an email to anyone except the signed-in test user. No password resets, invites or notifications for other accounts.`,
    `- If a test must create a user or record with an email address, use qa-${shortId(run.id)}-<n>@example.com.`,
    `- Only change data the test itself creates. Never edit or delete existing records, and never change the signed-in test account's password, email or role.`,
    `- No payments, exports to third parties, or anything irreversible outside this app.`,
    `- Skip a flow entirely if it can't be tested within these rules.`,
    ``,
    `## Output`,
    ``,
    `Plan at most ${maxTests} test cases, ordered by risk (most valuable first). Each case is one focused check.`,
    `Write steps as plain-language user actions on the live site (what to click, type or open), not code.`,
    `"expected" is what a user would see if the app works.`,
    ``,
    `Reply with only this JSON, no prose before or after:`,
    "```json",
    `{"cases": [{"title": "Short name of the check", "role": "${Object.keys(app.roles)[0]}", "kind": "base", "steps": ["Open /some/page", "Click Save"], "expected": "A confirmation message appears and the list shows the new item."}]}`,
    "```",
    `"role" must be one of: ${Object.keys(app.roles).join(", ")}. "kind" may be ${allowedKinds}.`
  ].join("\n");
}

export function buildPlanRetryPrompt(prompt: string, error: string) {
  return `${prompt}\n\n## Fix your previous answer\n\nYour previous answer was rejected: ${error}\nReply again with only the corrected JSON.`;
}

export function buildWritePrompt(run: Run, app: AppConfig, role: string, targets: SpecTarget[], context: RunContext | null, paths: { fixtureImport: string; verifyCommand: string }) {
  const cases = targets.flatMap((target, i) => [
    `### ${i + 1}. ${target.file}`,
    ``,
    `- Title: ${target.title}`,
    `- Kind: ${target.kind}`,
    `- Steps:`,
    ...target.steps.map((step) => `    - ${step}`),
    `- Expected: ${target.expected}`,
    ``
  ]);

  return [
    `You write Playwright end-to-end tests for ${app.name}, a deployed web app, and check that each one runs.`,
    ``,
    `## Setup`,
    ``,
    `- Live URL: ${app.baseUrl}. Tests use relative paths (page.goto("/admin/reviews")); baseURL is set.`,
    `- Every test here runs as the "${role}" role. The session is already signed in, so never log in or out.`,
    `- You have a Playwright browser (the playwright MCP tools) that is signed in as ${role} on the live URL. Use it to open the pages each case touches and find real, stable selectors before you write. Don't guess selectors from the code alone.`,
    context ? `- The app's code (${context.head.label} at ${shortSha(context.head.sha)}) is in ${context.codeDir.split("\\").join("/")} if you need to read it.` : `- The app's code isn't available; rely on the browser.`,
    `- Write each test to the exact file name given below, in the current directory.`,
    ``,
    `## Test cases`,
    ``,
    ...cases,
    `## How to write each file`,
    ``,
    `- Import only from the shared fixture: import { expect, test } from "${paths.fixtureImport}"; never from "@playwright/test" directly.`,
    `- One test per file. Its title is exactly the case title.`,
    `- Wrap each planned step in await test.step("<step text>", async () => { ... }).`,
    `- Locate elements with getByRole, getByLabel, getByText or getByTestId. Use CSS or XPath only when nothing else works. Never use waitForTimeout; rely on auto-waiting and expect.`,
    `- Assert the expected result exactly as planned. If the app doesn't do what the case expects, keep the assertion: that may be a real bug. Never weaken or delete an assertion to make a test pass.`,
    `- Anything a test creates must be removed in test.afterEach (or try/finally), so cleanup runs even when an assertion fails. Find it by the unique name the case uses.`,
    `- Style: TypeScript, double quotes, no semicolon directly after a closing brace, no trailing commas, no comments.`,
    ``,
    `## Safety rules (shared environment that sends real email)`,
    ``,
    `These apply to your own browsing as well as to the tests.`,
    ``,
    `- Only do what the planned steps need. Don't click other buttons that save, send, publish or delete.`,
    `- Never submit the contact form or trigger an email to anyone except the signed-in test user.`,
    `- If you must create a user or record with an email address, use qa-${shortId(run.id)}-<n>@example.com.`,
    `- Only change data that you or the test created; never edit or delete existing records or the test account itself.`,
    `- Delete anything you create while exploring before you finish.`,
    `- Never read, print or write passwords, secrets or .env files.`,
    ``,
    `## Check each test`,
    ``,
    `After writing a file, run it once with exactly:`,
    ``,
    `    ${paths.verifyCommand} <file name>`,
    ``,
    `If it fails because the test is wrong (selector, timing, navigation), fix the test and run it again, up to 3 tries.`,
    `If it fails because the app behaves differently from the expected result, stop fixing and report it as failed.`,
    ``,
    `## Output`,
    ``,
    `When every file is written and checked, reply with only this JSON:`,
    "```json",
    `{"cases": [{"file": "${targets[0]?.file ?? "01-example.${role}.spec.ts"}", "status": "passed", "note": "One sentence: what the test checks, or why it fails."}]}`,
    "```",
    `"status" is the result of your last run of that file: "passed" or "failed".`
  ].join("\n");
}
