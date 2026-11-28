import path from "node:path";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Section, Skeleton } from "@/components/page-header";
import { CaseStatusBadge, VerdictBadge, verdictDescriptions } from "@/components/status-badge";
import { formatDuration, parseDiff, pluralize, scenarioTitle, shortId } from "@/lib/helpers";
import { readRunFile, repairDiffPath } from "@/lib/run-files";
import { getCase, getRun } from "@/lib/runs";
import type { DiffLine } from "@/types/dashboard.types";
import type { Artifact } from "@/types/shared.types";

export default function TestPage({ params }: PageProps<"/projects/[slug]/runs/[id]/tests/[testId]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <TestDetail params={params} />
    </Suspense>
  );
}

async function TestDetail({ params }: { params: Promise<{ slug: string; id: string; testId: string }> }) {
  const { slug, id, testId } = await params;
  await connection();
  const [found, detail] = await Promise.all([getRun(id), getCase(id, testId)]);
  if (!found || found.app.slug !== slug || !detail) notFound();

  const { run, app } = found;
  const { testCase, artifacts } = detail;
  const [spec, repairDiff] = testCase.specPath ? await Promise.all([readRunFile(testCase.specPath), readRunFile(repairDiffPath(run.id, path.basename(testCase.specPath)))]) : [null, null];
  const repairChanges = repairDiff ? parseDiff(repairDiff) : [];
  const videos = artifacts.filter((artifact) => artifact.type === "video");
  const screenshots = artifacts.filter((artifact) => artifact.type === "screenshot");
  const traces = artifacts.filter((artifact) => artifact.type === "trace");
  const meta = [`as ${testCase.role}`, testCase.kind === "edge" ? "edge case" : "base case", testCase.durationMs !== null ? formatDuration(testCase.durationMs) : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Projects" },
          { href: `/projects/${app.slug}`, label: app.name },
          { href: `/projects/${app.slug}/runs/${run.id}`, label: `${scenarioTitle(run)} · ${shortId(run.id)}` }
        ]}
        title={testCase.title}
        description={meta}
        aside={
          <>
            {testCase.verdict && <VerdictBadge verdict={testCase.verdict} />}
            <CaseStatusBadge status={testCase.status} />
          </>
        }
      />

      {(testCase.notes || testCase.verdict) && (
        <div className="rounded-lg border bg-panel px-4 py-3 text-sm">
          <p className="font-medium">Claude&apos;s notes</p>
          {testCase.verdict && <p className="mt-1 text-muted">{verdictDescriptions[testCase.verdict]}</p>}
          {testCase.notes && <p className="mt-2 whitespace-pre-line">{testCase.notes}</p>}
        </div>
      )}

      {repairChanges.length > 0 && <RepairChanges lines={repairChanges} />}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <Section title="Steps">
            <ol className="flex flex-col gap-2 text-sm">
              {testCase.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-panel text-xs text-muted tabular-nums ring-1 ring-line">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Expected result">
            <p className="text-sm">{testCase.expected}</p>
          </Section>
        </div>

        <div className="flex flex-col gap-8">
          <Section title="Video">
            {videos.length > 0 ? videos.map((video) => <video key={video.id} src={`/artifacts/${video.id}`} controls className="w-full rounded-lg border bg-black" />) : <Empty>No video recorded.</Empty>}
          </Section>
          <Section title="Screenshots">
            {screenshots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {screenshots.map((shot) => (
                  <a key={shot.id} href={`/artifacts/${shot.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local artifact files, not optimizable images */}
                    <img src={`/artifacts/${shot.id}`} alt={path.basename(shot.path)} className="w-full rounded-lg border" />
                  </a>
                ))}
              </div>
            ) : (
              <Empty>No screenshots.</Empty>
            )}
          </Section>
          <Section title="Trace">{traces.length > 0 ? traces.map((trace) => <TraceLink key={trace.id} trace={trace} />) : <Empty>No trace recorded.</Empty>}</Section>
        </div>
      </div>

      <Section title="Spec" aside={testCase.specPath && <span className="truncate font-mono text-xs text-muted">{testCase.specPath}</span>}>
        {spec !== null ? <pre className="overflow-auto rounded-lg border bg-panel p-4 font-mono text-xs leading-relaxed">{spec}</pre> : <Empty>{testCase.status === "planned" ? "Not written yet." : "Spec file not found."}</Empty>}
      </Section>
    </>
  );
}

const diffLineClasses: Record<DiffLine["kind"], string> = {
  hunk: "text-sky-700 dark:text-sky-300",
  add: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  remove: "bg-red-500/10 text-red-800 dark:text-red-300",
  context: ""
}

function RepairChanges({ lines }: { lines: DiffLine[] }) {
  const added = lines.filter((line) => line.kind === "add").length;
  const removed = lines.filter((line) => line.kind === "remove").length;

  return (
    <Section title="Repair changes" aside={<span className="text-xs text-muted tabular-nums">{`${pluralize(added, "line")} added, ${removed} removed`}</span>}>
      <pre className="overflow-auto rounded-lg border bg-panel py-3 font-mono text-xs leading-relaxed">
        <div className="min-w-max">
          {lines.map((line, i) => (
            <span key={i} className={`block px-4 ${diffLineClasses[line.kind]}`}>
              {line.text || " "}
            </span>
          ))}
        </div>
      </pre>
    </Section>
  );
}

function TraceLink({ trace }: { trace: Artifact }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <a href={`/artifacts/${trace.id}?download=1`} className="w-fit font-medium underline underline-offset-2">
        Download {path.basename(trace.path)}
      </a>
      <p className="text-xs break-all text-muted">
        Open it with <code className="font-mono">pnpm exec playwright show-trace {trace.path}</code>
      </p>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted">{children}</p>;
}
