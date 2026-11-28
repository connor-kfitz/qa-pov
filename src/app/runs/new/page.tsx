import Link from "next/link";

import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Skeleton } from "@/components/page-header";
import { listAppConfigs } from "@/lib/app-config";
import { listBranches, listRecentCommits } from "@/lib/git";
import { shortId } from "@/lib/helpers";
import { getActiveRun } from "@/lib/runs";
import { NewRunForm } from "./new-run-form";

export default function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  return (
    <>
      <PageHeader
        title="New run"
        crumbs={[{ href: "/", label: "Projects" }]}
        description="Claude plans test cases, writes Playwright specs against the live env, runs them and reports back."
      />
      <Suspense fallback={<Skeleton rows={6} />}>
        <NewRunLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewRunLoader({ searchParams }: { searchParams: PageProps<"/runs/new">["searchParams"] }) {
  const { app } = await searchParams;
  await connection();
  const [apps, activeRun] = await Promise.all([listAppConfigs(), getActiveRun()]);
  const options = await Promise.all(
    apps.map(async (config) => ({
      slug: config.slug,
      name: config.name,
      baseUrl: config.baseUrl,
      compareBranch: config.compareBranch,
      roles: Object.keys(config.roles),
      branches: await listBranches(config.repoPath),
      commits: await listRecentCommits(config.repoPath, config.compareBranch)
    }))
  );
  return (
    <>
      {activeRun && (
        <p className="max-w-2xl rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-200">
          <Link href={`/projects/${activeRun.app.slug}/runs/${activeRun.run.id}`} className="underline underline-offset-2">
            Run {shortId(activeRun.run.id)}
          </Link>{" "}
          ({activeRun.app.name}) is in progress. A new run is queued and starts when it finishes.
        </p>
      )}
      <NewRunForm apps={options} initialApp={typeof app === "string" ? app : undefined} />
    </>
  );
}
