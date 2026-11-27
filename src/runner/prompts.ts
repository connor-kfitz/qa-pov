import { shortId, shortSha } from "@/lib/helpers";
import type { RunContext } from "@/types/runner.types";
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
