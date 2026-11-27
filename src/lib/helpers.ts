import { caseStatusEnum } from "@/db/schema";
import { testPlanSchema } from "@/lib/plan-schema";
import type { ProjectRun, RunGroup, StepState } from "@/types/dashboard.types";
import type { PlanParseResult, PlaywrightReport, ReportSuite, ReportedTest } from "@/types/runner.types";
import type { CaseCounts, Depth, Run, RunStatus, TestCase } from "@/types/shared.types";

export const runSteps = ["preparing", "planning", "writing", "running", "repairing", "saving"] as const satisfies RunStatus[];

const activeStatuses: RunStatus[] = ["queued", ...runSteps];

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateTimeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000]
];

export function isActive(status: RunStatus) {
  return activeStatuses.includes(status);
}

export function emptyCounts(): CaseCounts {
  return Object.fromEntries(caseStatusEnum.enumValues.map((status) => [status, 0])) as CaseCounts;
}

export function countByStatus(cases: TestCase[]) {
  const counts = emptyCounts();
  for (const testCase of cases) counts[testCase.status] += 1;
  return counts;
}

export function failedStep(run: Run) {
  const prefix = run.error?.split(":")[0];
  return runSteps.find((step) => step === prefix) ?? null;
}

export function stepStates(run: Run): StepState[] {
  if (run.status === "done") return runSteps.map(() => "done");

  const current = runSteps.findIndex((step) => step === run.status);
  if (current !== -1) return runSteps.map((_, i) => (i < current ? "done" : i === current ? "current" : "pending"));

  const stopped = runSteps.findIndex((step) => step === failedStep(run));
  if (stopped === -1) return runSteps.map(() => "pending");
  const stoppedState = run.status === "blocked" ? "blocked" : "failed";
  return runSteps.map((_, i) => (i < stopped ? "done" : i === stopped ? stoppedState : "pending"));
}

export function groupRuns(runs: ProjectRun[]) {
  const groups = new Map<string, RunGroup>();
  for (const projectRun of runs) {
    const { run } = projectRun;
    const key = run.scenario === "codebase" ? `branch:${run.compareRef}` : `feature:${run.featureRef}`;
    const group = groups.get(key) ?? { key, label: scenarioTitle(run), kind: run.scenario, runs: [] };
    group.runs.push(projectRun);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function stripStepPrefix(error: string) {
  return error.replace(/^\w+:\s*/, "");
}

export function emptyRunMessage(run: Run) {
  if (isActive(run.status)) return "Test cases appear once the plan step finishes.";
  if (run.error) return stripStepPrefix(run.error);
  return "No test cases.";
}

export function deployedCommitLabel(run: Run) {
  if (!run.deployedCommitStart) return null;
  const start = shortSha(run.deployedCommitStart);
  const end = run.deployedCommitEnd ? shortSha(run.deployedCommitEnd) : null;
  return end && end !== start ? `${start} → ${end}` : start;
}

export function entireBranchLabel(run: Run) {
  return run.compareRef ? `Entire branch · ${run.compareRef}` : "Entire branch";
}

export function scenarioTitle(run: Run) {
  return run.scenario === "feature" ? (run.featureRef ?? "Feature") : entireBranchLabel(run);
}

export function scenarioDetail(run: Run) {
  return run.scenario === "feature" ? `Feature vs ${run.compareRef ?? "develop"}` : entireBranchLabel(run);
}

export function depthLabel(depth: Run["depth"]) {
  return depth === "base" ? "Base cases" : "Base + edge cases";
}

export function runDuration(run: Run, now: number) {
  if (!run.startedAt) return null;
  const end = run.finishedAt?.getTime() ?? now;
  return formatDuration(end - run.startedAt.getTime());
}

export function formatRelative(date: Date, now: number) {
  const diff = date.getTime() - now;
  for (const [unit, ms] of relativeUnits) {
    if (Math.abs(diff) >= ms) return relativeFormat.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

export function formatDuration(ms: number) {
  if (ms < 1000) return "<1s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}

function envName(...parts: string[]) {
  return parts.join("_").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function roleEnvNames(slug: string, role: string) {
  const prefix = envName(slug, role);
  return { emailEnv: `${prefix}_EMAIL`, passwordEnv: `${prefix}_PASSWORD` }
}

export function bypassSecretEnvName(slug: string) {
  return envName(slug, "bypass_secret");
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function navLinkClass(active: boolean) {
  return `flex min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-hover font-medium text-foreground" : "text-muted hover:bg-hover hover:text-foreground"}`;
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in Claude's answer");
  return JSON.parse(body.slice(start));
}

export function truncate(text: string, maxChars: number) {
  return text.length <= maxChars ? { text, truncated: false } : { text: text.slice(0, maxChars), truncated: true }
}

export function parsePlan(answer: string, roles: string[], depth: Depth): PlanParseResult {
  let json: unknown;
  try {
    json = extractJson(answer);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const parsed = testPlanSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }

  const unknownRoles = [...new Set(parsed.data.cases.map((testCase) => testCase.role).filter((role) => !roles.includes(role)))];
  if (unknownRoles.length > 0) return { ok: false, error: `Unknown role(s) ${unknownRoles.join(", ")}; use one of ${roles.join(", ")}` }

  const cases = depth === "base" ? parsed.data.cases.filter((testCase) => testCase.kind === "base") : parsed.data.cases;
  if (cases.length === 0) return { ok: false, error: "The plan has no usable cases" }
  return { ok: true, plan: { cases }, droppedEdgeCases: parsed.data.cases.length - cases.length }
}

export function stripAnsi(text: string) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

const reportStatuses: Record<string, ReportedTest["status"]> = {
  expected: "passed",
  unexpected: "failed",
  flaky: "flaky",
  skipped: "skipped"
}

export function flattenReport(report: PlaywrightReport): ReportedTest[] {
  const walk = (suite: ReportSuite): ReportedTest[] => [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => {
        const last = test.results.at(-1);
        const failure = test.results.find((result) => result.error?.message)?.error?.message ?? null;
        return {
          file: spec.file,
          title: spec.title,
          project: test.projectName,
          status: reportStatuses[test.status] ?? "failed",
          durationMs: last?.duration ?? 0,
          error: failure ? stripAnsi(failure) : null,
          attachments: (last?.attachments ?? []).flatMap((attachment) => (attachment.path ? [{ name: attachment.name, path: attachment.path }] : []))
        }
      })
    ),
    ...(suite.suites ?? []).flatMap(walk)
  ];
  return report.suites.flatMap(walk);
}

export function todo(what: string): never {
  throw new Error(`not implemented yet: ${what}`);
}
