"use client";

import Link from "next/link";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BranchIcon, Chevron, StackIcon } from "@/components/icons";
import { RunStatusDot } from "@/components/status-badge";
import { formatRelative, navLinkClass, navLocation, shortId } from "@/lib/helpers";
import { setNodeOpen, useOpenNodes } from "@/lib/nav-state";
import type { NavBranch, NavLocation, NavProject, NavRun } from "@/types/dashboard.types";

const visibleRuns = 5;

export function ProjectTree({ projects, now }: { projects: NavProject[]; now: number }) {
  const location = navLocation(usePathname());
  const stored = useOpenNodes();

  return (
    <ul className="flex flex-col gap-0.5 px-3">
      {projects.map((project) => {
        const key = `project:${project.slug}`;
        const open = stored[key] ?? project.slug === location.slug;
        const active = project.slug === location.slug && !location.runId;

        return (
          <li key={project.slug}>
            <div className="flex items-center gap-0.5">
              <Toggle open={open} label={project.name} disabled={project.branches.length === 0} onToggle={() => setNodeOpen(key, !open)}/>
              <Link href={`/projects/${project.slug}`} aria-current={active ? "page" : undefined} className={`${navLinkClass(active)} flex-1 pl-1.5`}>
                <RunStatusDot status={project.status}/>
                <span className="truncate">{project.name}</span>
                {project.runCount > 0 && <span className="ml-auto pl-2 text-xs text-subtle tabular-nums">{project.runCount}</span>}
              </Link>
            </div>
            {open && project.branches.length > 0 && (
              <Children>
                {project.branches.map((branch) => (
                  <BranchNode key={branch.name} slug={project.slug} branch={branch} location={location} stored={stored} now={now}/>
                ))}
              </Children>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BranchNode({ slug, branch, location, stored, now }: { slug: string; branch: NavBranch; location: NavLocation; stored: Record<string, boolean>; now: number }) {
  const key = `branch:${slug}:${branch.name}`;
  const holdsCurrent = [...branch.runs, ...branch.features.flatMap((feature) => feature.runs)].some((run) => run.id === location.runId);
  const open = stored[key] ?? holdsCurrent;

  return (
    <li>
      <FolderRow open={open} title={`Branch ${branch.name}: entire-branch runs and the features run against it`} icon={<StackIcon/>} label={branch.name} count={branch.runCount} current={holdsCurrent} onToggle={() => setNodeOpen(key, !open)}/>
      {open && (
        <Children>
          {branch.features.map((feature) => {
            const featureKey = `feature:${slug}:${branch.name}:${feature.name}`;
            const featureHoldsCurrent = feature.runs.some((run) => run.id === location.runId);
            const featureOpen = stored[featureKey] ?? featureHoldsCurrent;
            return (
              <li key={feature.name}>
                <FolderRow
                  open={featureOpen}
                  title={`Feature ${feature.name}, run against ${branch.name}`}
                  icon={<BranchIcon/>}
                  label={feature.name}
                  count={feature.runs.length}
                  current={featureHoldsCurrent}
                  onToggle={() => setNodeOpen(featureKey, !featureOpen)}
                />
                {featureOpen && (
                  <Children>
                    <RunRows slug={slug} runs={feature.runs} location={location} now={now}/>
                  </Children>
                )}
              </li>
            );
          })}
          <RunRows slug={slug} runs={branch.runs} location={location} now={now} title="Entire-branch run"/>
        </Children>
      )}
    </li>
  );
}

function RunRows({ slug, runs, location, now, title }: { slug: string; runs: NavRun[]; location: NavLocation; now: number; title?: string }) {
  const shown = runs.filter((run, i) => i < visibleRuns || run.id === location.runId);

  return (
    <>
      {shown.map((run) => {
        const active = run.id === location.runId;
        return (
          <li key={run.id}>
            <Link href={`/projects/${slug}/runs/${run.id}`} title={title} aria-current={active ? "page" : undefined} className={`${navLinkClass(active)} pl-2`}>
              <RunStatusDot status={run.status}/>
              <span className="font-mono text-xs">{shortId(run.id)}</span>
              <span className="ml-auto pl-2 text-xs text-subtle">{formatRelative(run.createdAt, now)}</span>
            </Link>
          </li>
        );
      })}
      {runs.length > shown.length && (
        <li>
          <Link href={`/projects/${slug}`} className="block px-2 py-1 text-xs text-subtle hover:text-foreground">
            Show all ({runs.length})
          </Link>
        </li>
      )}
    </>
  );
}

function FolderRow({ open, title, icon, label, count, current, onToggle }: { open: boolean; title: string; icon: ReactNode; label: string; count: number; current: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} title={title} className={`${navLinkClass(false)} w-full gap-2 pl-1.5 text-left`}>
      <Chevron className={open ? "rotate-90" : ""}/>
      {icon}
      <span className={`truncate ${current ? "text-foreground" : ""}`}>{label}</span>
      <span className="ml-auto pl-2 text-xs text-subtle tabular-nums">{count}</span>
    </button>
  );
}

function Children({ children }: { children: ReactNode }) {
  return <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l pl-1.5">{children}</ul>;
}

function Toggle({ open, label, disabled, onToggle }: { open: boolean; label: string; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      disabled={disabled}
      onClick={onToggle}
      className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-hover disabled:invisible"
    >
      <Chevron className={open ? "rotate-90" : ""}/>
    </button>
  );
}
