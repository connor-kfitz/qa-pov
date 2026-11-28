import Link from "next/link";

import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Skeleton, buttonClass } from "@/components/page-header";
import { RunStatusBadge } from "@/components/status-badge";
import { formatRelative, scenarioTitle } from "@/lib/helpers";
import { listProjects } from "@/lib/projects";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project is a deployed web app with its own test logins. Pick one to see its runs."
        aside={
          <Link href="/projects/new" className={buttonClass}>
            New project
          </Link>
        }
      />
      <Suspense fallback={<Skeleton rows={3}/>}>
        <ProjectGrid/>
      </Suspense>
    </>
  );
}

async function loadProjects() {
  const projects = await listProjects();
  return { projects, now: Date.now() };
}

async function ProjectGrid() {
  await connection();
  const { projects, now } = await loadProjects();

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted">
        <p className="font-medium text-foreground">No projects yet</p>
        <p className="mt-1">
          <Link href="/projects/new" className="underline underline-offset-2 hover:text-foreground">
            Add a project
          </Link>{" "}
          to start your first run.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <Link key={project.slug} href={`/projects/${project.slug}`} className="flex flex-col gap-4 rounded-lg border bg-panel p-5 hover:bg-hover">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{project.name}</span>
            <span className="truncate font-mono text-xs text-muted">{project.baseUrl.replace(/^https?:\/\//, "")}</span>
          </div>
          {project.latestRun ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-subtle">Latest run · {formatRelative(project.latestRun.createdAt, now)}</span>
              <span className="flex min-w-0 items-center gap-2">
                <RunStatusBadge status={project.latestRun.status}/>
                <span className="truncate">{scenarioTitle(project.latestRun)}</span>
              </span>
            </div>
          ) : (
            <span className="text-sm text-subtle">No runs yet</span>
          )}
          <span className="mt-auto text-xs text-muted">
            {project.runCount} {project.runCount === 1 ? "run" : "runs"}
            {project.roles.length > 0 && ` · roles: ${project.roles.join(", ")}`}
          </span>
        </Link>
      ))}
    </div>
  );
}
