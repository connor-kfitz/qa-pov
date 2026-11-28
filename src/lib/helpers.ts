import { caseStatusEnum } from "@/db/schema";
import type { ZodType } from "zod";
import { testPlanSchema } from "@/lib/plan-schema";
import type { CommitOption, DiffLine, NavBranch, NavLocation, NavRun, ProjectRun, RefSuggestion, RunCostSample, RunDraft, RunEstimate, RunGroup, StepCosts, StepState } from "@/types/dashboard.types";
import type { PlanParseResult, PlaywrightReport, ReportSuite, ReportedTest } from "@/types/runner.types";
import type { CaseCounts, ClaudeCall, ClaudeStep, Depth, ModelChoice, RoleConfig, Run, RunScope, RunStatus, StepModels, TestCase } from "@/types/shared.types";

export const runSteps = ["preparing", "planning", "writing", "running", "repairing", "saving"] as const satisfies RunStatus[];
export const claudeSteps = ["planning", "writing", "repairing"] as const satisfies ClaudeStep[];
export const modelChoices = ["opus", "sonnet", "haiku"] as const satisfies ModelChoice[];
export const defaultStepModels: StepModels = { planning: "opus", writing: "sonnet", repairing: "opus" }
export const defaultMaxTests = 25;

const modelLabels: Record<ModelChoice, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku"
}

const stepLabels: Record<(typeof runSteps)[number], string> = {
  preparing: "Prepare",
  planning: "Plan",
  writing: "Write",
  running: "Run",
  repairing: "Repair",
  saving: "Save"
}

const activeStatuses: RunStatus[] = ["queued", ...runSteps];

export const sidebarWidths = { min: 200, max: 480, initial: 256 }
export const sidebarWidthKey = "qa-pov:sidebar-width";
export const savedSecretMask = "••••••••";

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateTimeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const shortDateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const usdFormat =new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD" });

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

export function stepLabel(step: RunStatus) {
  const known = runSteps.find((runStep) => runStep === step);
  return known ? stepLabels[known] : step;
}

export function modelLabel(model: ModelChoice | undefined) {
  return model ? modelLabels[model] : "CLI default";
}

export function stepModelsLabel(models: StepModels) {
  return claudeSteps.map((step) => `${stepLabel(step)} ${modelLabel(models[step])}`).join(" · ");
}

export function primaryModel(modelUsage: unknown) {
  if (!modelUsage || typeof modelUsage !== "object") return undefined;
  const entries = Object.entries(modelUsage as Record<string, { costUSD?: number }>);
  entries.sort(([, a], [, b]) => (b.costUSD ?? 0) - (a.costUSD ?? 0));
  return entries[0]?.[0];
}

export function maxTestsLabel(maxTests: number | null) {
  return maxTests === null ? `${defaultMaxTests} (default)` : String(maxTests);
}

export function draftFromForm(form: FormData): Pick<RunDraft, "depth" | "maxTests" | "models"> {
  const maxTests = Number(form.get("maxTests"));
  const models: StepModels = {}
  for (const step of claudeSteps) {
    const choice = modelChoices.find((model) => model === form.get(step));
    if (choice) models[step] = choice;
  }
  return { depth: form.get("depth") === "base_edge" ? "base_edge" : "base", maxTests: Number.isInteger(maxTests) && maxTests > 0 ? maxTests : null, models }
}

export function estimateRun(samples: RunCostSample[], draft: RunDraft): RunEstimate {
  const sameProject = samples.filter((sample) => sample.app === draft.app);
  const pool = sameProject.length > 0 ? sameProject : samples;
  const similar = pool.filter((sample) => sample.scenario === draft.scenario && sample.depth === draft.depth);
  const cap = draft.maxTests ?? defaultMaxTests;
  const typical = similar.length > 0 ? Math.round(sumOf(similar, (sample) => sample.tests) / similar.length) : null;
  const tests = typical === null ? cap : Math.min(typical, cap);
  const basis = { tests, testsFromHistory: typical !== null, sampleRuns: pool.length, sameProject: sameProject.length > 0 }
  if (pool.length === 0) return { ...basis, costUsd: null, modelsMatched: false }

  let costUsd = 0;
  let modelsMatched = true;
  for (const step of claudeSteps) {
    const matching = pool.filter((sample) => sample.models[step] === draft.models[step]);
    if (matching.length === 0) modelsMatched = false;
    const runs = matching.length > 0 ? matching : pool;
    const stepCost = sumOf(runs, (sample) => sample.costs[step] ?? 0);
    costUsd += step === "planning" ? stepCost / runs.length : (stepCost / Math.max(1, sumOf(runs, (sample) => sample.tests))) * tests;
  }
  return { ...basis, costUsd, modelsMatched }
}

function sumOf<T>(items: T[], value: (item: T) => number) {
  return items.reduce((sum, item) => sum + value(item), 0);
}

export function totalCost(calls: ClaudeCall[]) {
  return calls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0);
}

export function costByStep(calls: ClaudeCall[]) {
  const costs: StepCosts = {};
  for (const call of calls) costs[call.step] = (costs[call.step] ?? 0) + (call.costUsd ?? 0);
  return costs;
}

export function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function parseDiff(diff: string): DiffLine[] {
  const lines = diff.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk === -1) return [];
  return lines
    .slice(firstHunk)
    .filter((line) => !line.startsWith("\\ No newline"))
    .map((line) => ({ kind: line.startsWith("@@") ? "hunk" : line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : "context", text: line }));
}

export function formatCost(usd: number) {
  if (usd > 0 && usd < 0.01) return `<${usdFormat.format(0.01)}`;
  return usdFormat.format(usd);
}

export function failedStep(run: Run) {
  const prefix = run.error?.split(":")[0];
  return runSteps.find((step) => step === prefix) ?? null;
}

export function retrySteps(run: Run): RunStatus[] {
  if (run.status !== "failed" && run.status !== "blocked") return [];
  const stopped = runSteps.findIndex((step) => step === failedStep(run));
  return stopped === -1 ? [...runSteps] : runSteps.slice(0, stopped + 1);
}

export function stepStates(run: Run): StepState[] {
  if (run.status === "done") return runSteps.map(() => "done");

  const resumeAt = runSteps.findIndex((step) => step === run.retryFrom);
  if (run.status === "queued" && resumeAt !== -1) return runSteps.map((_, i) => (i < resumeAt ? "done" : "pending"));

  const current = runSteps.findIndex((step) => step === run.status);
  if (current !== -1) return runSteps.map((_, i) => (i < current ? "done" : i === current ? "current" : "pending"));

  const stopped = runSteps.findIndex((step) => step === failedStep(run));
  if (stopped === -1) return runSteps.map(() => "pending");
  const stoppedState = run.status === "blocked" ? "blocked" : "failed";
  return runSteps.map((_, i) => (i < stopped ? "done" : i === stopped ? stoppedState : "pending"));
}

export function runGroupKey(run: RunScope) {
  return run.scenario === "codebase" ? `branch:${run.compareRef}` : `feature:${run.featureRef}`;
}

export function groupRuns(runs: ProjectRun[]) {
  const groups = new Map<string, RunGroup>();
  for (const projectRun of runs) {
    const { run } = projectRun;
    const key = runGroupKey(run);
    const group = groups.get(key) ?? { key, label: scenarioTitle(run), kind: run.scenario, runs: [] };
    group.runs.push(projectRun);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function buildNavBranches(runs: (NavRun & RunScope)[]) {
  const branches = new Map<string, NavBranch>();
  for (const run of runs) {
    const name = run.compareRef ?? "default branch";
    const branch = branches.get(name) ?? { name, runs: [], features: [], runCount: 0 };
    const navRun = { id: run.id, status: run.status, createdAt: run.createdAt };
    branch.runCount += 1;
    if (run.scenario === "feature") {
      const featureName = run.featureRef ?? "Feature";
      const feature = branch.features.find((existing) => existing.name === featureName);
      if (feature) feature.runs.push(navRun);
      else branch.features.push({ name: featureName, runs: [navRun] });
    } else {
      branch.runs.push(navRun);
    }
    branches.set(name, branch);
  }
  return [...branches.values()];
}

export function clampSidebarWidth(width: number) {
  return Math.round(Math.min(sidebarWidths.max, Math.max(sidebarWidths.min, width)));
}

export function sidebarWidthScript() {
  const { min, max } = sidebarWidths;
  return `try{var w=Number(localStorage.getItem(${JSON.stringify(sidebarWidthKey)}));if(w>=${min}&&w<=${max})document.documentElement.style.setProperty("--sidebar-width",w+"px")}catch(e){}`;
}

export function formatShortDate(iso: string) {
  return shortDateFormat.format(new Date(iso));
}

export function commitRange(sha: string) {
  return `${sha}~1..${sha}`;
}

export function refSuggestions(query: string, branches: string[], commits: CommitOption[], exclude: string, limit = 8): RefSuggestion[] {
  const needle = query.trim().toLowerCase();
  const matchingBranches = branches.filter((branch) => branch !== exclude && branch.toLowerCase().includes(needle)).slice(0, limit);
  const matchingCommits = commits.filter((commit) => !needle || commitRange(commit.sha).toLowerCase().includes(needle) || commit.subject.toLowerCase().includes(needle)).slice(0, limit);
  return [
    ...matchingBranches.map((name) => ({ kind: "branch" as const, value: name, name })),
    ...matchingCommits.map((commit) => ({ kind: "commit" as const, value: commitRange(commit.sha), commit }))
  ];
}

export function navLocation(pathname: string): NavLocation {
  const [, section, slug, child, runId] = pathname.split("/");
  if (section !== "projects" || !slug || slug === "new") return { slug: null, runId: null };
  return { slug, runId: child === "runs" && runId ? runId : null }
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

export function entireBranchLabel(run: RunScope) {
  return run.compareRef ? `Entire branch · ${run.compareRef}` : "Entire branch";
}

export function scenarioTitle(run: RunScope) {
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

export function resolveRoleEnv(slug: string, roleName: string, previous: RoleConfig | undefined) {
  return previous && !("skip" in previous) ? { emailEnv: previous.emailEnv, passwordEnv: previous.passwordEnv } : roleEnvNames(slug, roleName);
}

export function bypassSecretEnvName(slug: string) {
  return envName(slug, "bypass_secret");
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
  return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
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

export function toPosix(file: string) {
  return file.split(/[\/]/).join("/");
}

export function parseByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

export function parseAnswer<T>(answer: string, answerSchema: ZodType<T>): T | null {
  try {
    const parsed = answerSchema.safeParse(extractJson(answer));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function todo(what: string): never {
  throw new Error(`not implemented yet: ${what}`);
}
