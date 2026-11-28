import Link from "next/link";

import { CaseSummary } from "@/components/case-summary";
import { BranchIcon, Chevron, StackIcon } from "@/components/icons";
import { CaseStatusBadge, RunStatusBadge, VerdictBadge } from "@/components/status-badge";
import { countByStatus, depthLabel, emptyRunMessage, formatCost, formatDateTime, formatRelative, groupRuns, runDuration, shortId } from "@/lib/helpers";
import type { ProjectRun } from "@/types/dashboard.types";

export function RunTree({ slug, runs, now }: { slug: string; runs: ProjectRun[]; now: number }) {
  const latestRunId = runs[0]?.run.id;

  return (
    <div className="flex flex-col gap-3">
      {groupRuns(runs).map((group) => (
        <details key={group.key} open className="group/branch overflow-hidden rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-3 bg-panel px-4 py-3 select-none hover:bg-hover">
            <Chevron className="group-open/branch:rotate-90"/>
            {group.kind === "feature" ? <BranchIcon/> : <StackIcon/>}
            <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>
            <span className="hidden text-xs text-muted sm:inline">
              {group.runs.length} {group.runs.length === 1 ? "run" : "runs"}
            </span>
            <RunStatusBadge status={group.runs[0].run.status}/>
          </summary>
          <ul className="divide-y border-t">
            {group.runs.map(({ run, cases, costUsd }) => (
              <li key={run.id}>
                <details open={run.id === latestRunId} className="group/run">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-4 pl-9 select-none hover:bg-hover">
                    <Chevron className="group-open/run:rotate-90"/>
                    <RunStatusBadge status={run.status}/>
                    <Link href={`/projects/${slug}/runs/${run.id}`} title={formatDateTime(run.createdAt)} className="text-sm font-medium hover:underline">
                      Run {shortId(run.id)}
                    </Link>
                    <span className="text-xs text-muted">
                      {formatRelative(run.createdAt, now)} · {depthLabel(run.depth)}
                      {runDuration(run, now) && ` · ${runDuration(run, now)}`}
                      {costUsd !== null && ` · ${formatCost(costUsd)}`}
                    </span>
                    <span className="ml-auto hidden md:flex">
                      <CaseSummary counts={countByStatus(cases)}/>
                    </span>
                  </summary>
                  <ul className="mb-2 ml-[3.35rem] border-l">
                    {cases.map((testCase) => (
                      <li key={testCase.id}>
                        <Link href={`/projects/${slug}/runs/${run.id}/tests/${testCase.id}`} className="flex items-center gap-3 py-1.5 pr-4 pl-4 text-sm hover:bg-hover">
                          <CaseStatusBadge status={testCase.status}/>
                          <span className="min-w-0 flex-1 truncate">{testCase.title}</span>
                          {testCase.verdict && <VerdictBadge verdict={testCase.verdict}/>}
                          <span className="hidden w-16 text-right text-xs text-muted sm:inline">{testCase.role}</span>
                        </Link>
                      </li>
                    ))}
                    {cases.length === 0 && <li className="py-1.5 pr-4 pl-4 text-sm text-muted">{emptyRunMessage(run)}</li>}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
