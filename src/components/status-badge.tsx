import type { Tone } from "@/types/dashboard.types";
import type { CaseStatus, RunStatus, Verdict } from "@/types/shared.types";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-zinc-500/10 text-muted ring-zinc-500/20",
  progress: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  danger: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300",
  warning: "bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-300",
  info: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300"
}

const dotClasses: Record<Tone, string> = {
  neutral: "bg-zinc-400 dark:bg-zinc-500",
  progress: "bg-sky-500 animate-pulse",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-violet-500"
}

const runStatuses: Record<RunStatus, [string, Tone]> = {
  queued: ["Queued", "neutral"],
  preparing: ["Preparing", "progress"],
  planning: ["Planning", "progress"],
  writing: ["Writing tests", "progress"],
  running: ["Running", "progress"],
  repairing: ["Repairing", "progress"],
  saving: ["Saving", "progress"],
  done: ["Done", "success"],
  failed: ["Failed", "danger"],
  blocked: ["Blocked", "warning"],
  cancelled: ["Cancelled", "neutral"]
}

const caseStatuses: Record<CaseStatus, [string, Tone]> = {
  planned: ["Planned", "neutral"],
  written: ["Written", "progress"],
  passed: ["Passed", "success"],
  failed: ["Failed", "danger"],
  flaky: ["Flaky", "warning"],
  skipped: ["Skipped", "neutral"]
}

const verdicts: Record<Verdict, [string, Tone]> = {
  app_bug: ["App bug", "danger"],
  bad_test: ["Bad test", "info"],
  env_problem: ["Env problem", "warning"]
}

export const verdictDescriptions: Record<Verdict, string> = {
  app_bug: "The test is right and the app did the wrong thing.",
  bad_test: "The test itself was wrong; Claude fixed and re-ran it.",
  env_problem: "The environment misbehaved, so this result says nothing about the feature."
}

function Badge({ label, tone, pulse }: { label: string; tone: Tone; pulse?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${toneClasses[tone]}`}>
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current"/>}
      {label}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const [label, tone] = runStatuses[status];
  return <Badge label={label} tone={tone} pulse={tone === "progress"}/>;
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const [label, tone] = caseStatuses[status];
  return <Badge label={label} tone={tone}/>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const [label, tone] = verdicts[verdict];
  return <Badge label={label} tone={tone}/>;
}

export function RunStatusDot({ status }: { status: RunStatus | null }) {
  const [label, tone] = status ? runStatuses[status] : ["No runs yet", "neutral" as const];
  return <span title={label} className={`size-2 shrink-0 rounded-full ${status ? dotClasses[tone] : "ring-1 ring-subtle ring-inset"}`}/>;
}
