import type { CaseCounts, CaseStatus } from "@/types/shared.types";

const shown: [CaseStatus, string][] = [
  ["passed", "bg-emerald-500"],
  ["failed", "bg-red-500"],
  ["flaky", "bg-amber-500"],
  ["skipped", "bg-zinc-400 dark:bg-zinc-500"],
  ["written", "bg-sky-500"],
  ["planned", "bg-zinc-300 dark:bg-zinc-600"]
];

export function CaseSummary({ counts }: { counts: CaseCounts }) {
  const parts = shown.filter(([status]) => counts[status] > 0);
  if (parts.length === 0) return <span className="text-subtle">—</span>;

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {parts.map(([status, dot]) => (
        <span key={status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`size-1.5 rounded-full ${dot}`} />
          <span className="tabular-nums">{counts[status]}</span>
          <span className="text-muted">{status}</span>
        </span>
      ))}
    </span>
  );
}
