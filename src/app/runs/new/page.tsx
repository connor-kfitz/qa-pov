import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Skeleton } from "@/components/page-header";
import { listAppConfigs } from "@/lib/app-config";
import { listBranches } from "@/lib/git";
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
  const apps = await listAppConfigs();
  const options = await Promise.all(
    apps.map(async (config) => ({
      slug: config.slug,
      name: config.name,
      baseUrl: config.baseUrl,
      compareBranch: config.compareBranch,
      roles: Object.keys(config.roles),
      branches: await listBranches(config.repoPath)
    }))
  );
  return <NewRunForm apps={options} initialApp={typeof app === "string" ? app : undefined} />;
}
