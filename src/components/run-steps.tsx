import { formatCost, runSteps, stepLabel, stepStates } from "@/lib/helpers";
import type { StepCosts, StepState } from "@/types/dashboard.types";
import type { Run } from "@/types/shared.types";

const stateClasses: Record<StepState, { dot: string; text: string }> = {
  done: { dot: "bg-emerald-500 ring-emerald-500", text: "text-foreground" },
  current: { dot: "animate-pulse bg-sky-500 ring-sky-500", text: "font-medium text-sky-700 dark:text-sky-300" },
  failed: { dot: "bg-red-500 ring-red-500", text: "font-medium text-red-700 dark:text-red-300" },
  blocked: { dot: "bg-amber-500 ring-amber-500", text: "font-medium text-amber-800 dark:text-amber-300" },
  pending: { dot: "bg-transparent ring-line", text: "text-subtle" }
}

export function RunSteps({ run, costs = {} }: { run: Run; costs?: StepCosts }) {
  const states = stepStates(run);

  return (
    <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
      {runSteps.map((step, i) => (
        <li key={step} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={`size-2.5 shrink-0 rounded-full ring-2 ring-inset ${stateClasses[states[i]].dot}`} />
            {i < runSteps.length - 1 && <span className={`h-px flex-1 ${states[i] === "done" ? "bg-emerald-500/50" : "bg-line"}`} />}
          </div>
          <div className="flex flex-col">
            <span className={`text-sm ${stateClasses[states[i]].text}`}>{stepLabel(step)}</span>
            {costs[step] !== undefined && <span className="text-xs text-muted tabular-nums">{formatCost(costs[step])}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
