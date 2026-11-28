import Link from "next/link";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader, Section, Skeleton, buttonClass, secondaryButtonClass } from "@/components/page-header";
import { RunTree } from "@/components/run-tree";
import { getProject, listProjectRuns } from "@/lib/projects";
import { isActive } from "@/lib/helpers";

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<Skeleton rows={6}/>}>
      <ProjectDetail params={params}/>
    </Suspense>
  );
}

async function loadProject(slug: string) {
  const project = await getProject(slug);
  if (!project) return null;
  const runs = project.app ? await listProjectRuns(project.app.id) : [];
  return { project, runs, now: Date.now() };
}

async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const loaded = await loadProject(slug);
  if (!loaded) notFound();

  const { project, runs, now } = loaded;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Projects" }]}
        title={project.name}
        description={
          <span className="flex flex-wrap gap-x-2">
            <a href={project.baseUrl} target="_blank" rel="noreferrer" className="font-mono underline decoration-line underline-offset-2 hover:decoration-muted">
              {project.baseUrl.replace(/^https?:\/\//, "")}
            </a>
            {project.roles.length > 0 && <span>· roles: {project.roles.join(", ")}</span>}
          </span>
        }
        aside={
          <>
            {runs.some(({ run }) => isActive(run.status)) && <AutoRefresh/>}
            {project.configured && (
              <>
                <Link href={`/projects/${project.slug}/edit`} className={secondaryButtonClass}>
                  Edit
                </Link>
                <Link href={`/runs/new?app=${project.slug}`} className={buttonClass}>
                  New run
                </Link>
              </>
            )}
          </>
        }
      />

      <Section title={`Runs (${runs.length})`}>
        {runs.length > 0 ? (
          <RunTree slug={project.slug} runs={runs} now={now}/>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted">No runs yet for this project.</p>
        )}
      </Section>
    </>
  );
}
