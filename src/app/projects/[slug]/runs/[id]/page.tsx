import Link from "next/link";

import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { CaseSummary } from "@/components/case-summary";
import { PageHeader, Section, Skeleton, panelClass } from "@/components/page-header";
import { RunSteps } from "@/components/run-steps";
import { CaseStatusBadge, RunStatusBadge, VerdictBadge } from "@/components/status-badge";
import { countByStatus, deployedCommitLabel, depthLabel, failedStep, formatDateTime, formatDuration, isActive, runDuration, scenarioDetail, scenarioTitle, shortId, shortSha, stripStepPrefix } from "@/lib/helpers";
import { readRunLog } from "@/lib/run-files";
import { getRun, listCases } from "@/lib/runs";
import type { Run, TestCase } from "@/types/shared.types";

export default function RunPage({ params }: PageProps<"/projects/[slug]/runs/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <RunDetail params={params} />
    </Suspense>
  );
}

async function loadRun(slug: string, id: string) {
  const found = await getRun(id);
  if (!found || found.app.slug !== slug) return null;
  const [cases, log] = await Promise.all([listCases(id), readRunLog(id)]);
  return { ...found, cases, log, now: Date.now() };
}

async function RunDetail({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  await connection();
  const loaded = await loadRun(slug, id);
  if (!loaded) notFound();

  const { run, app, cases, log, now } = loaded;
  const active = isActive(run.status);

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Projects" },
          { href: `/projects/${app.slug}`, label: app.name }
        ]}
        title={scenarioTitle(run)}
        description={`${scenarioDetail(run)} · ${depthLabel(run.depth)}`}
        aside={
          <>
            {active && <AutoRefresh />}
            <RunStatusBadge status={run.status} />
          </>
        }
      />

      <div className={`${panelClass} p-4`}>
        <RunSteps run={run} />
      </div>

      <RunAlerts run={run} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
        <Fact label="Env">
          <a href={app.baseUrl} target="_blank" rel="noreferrer" className="break-all underline decoration-line underline-offset-2 hover:decoration-muted">
            {app.baseUrl.replace(/^https?:\/\//, "")}
          </a>
        </Fact>
        <Fact label="Deployed commit">{deployedCommitLabel(run) ? <span className="font-mono">{deployedCommitLabel(run)}</span> : "—"}</Fact>
        <Fact label="Max tests">{run.maxTests ?? "No limit"}</Fact>
        <Fact label="Run id">
          <span className="font-mono" title={run.id}>
            {shortId(run.id)}
          </span>
        </Fact>
        <Fact label="Created">{formatDateTime(run.createdAt)}</Fact>
        <Fact label="Started">{run.startedAt ? formatDateTime(run.startedAt) : "—"}</Fact>
        <Fact label="Duration">{runDuration(run, now) ?? "—"}</Fact>
        <Fact label="Results">
          <CaseSummary counts={countByStatus(cases)} />
        </Fact>
      </dl>

      <Section title={`Test cases (${cases.length})`}>
        <CasesTable run={run} slug={app.slug} cases={cases} />
      </Section>

      <Section title="Runner log">
        {log === null ? (
          <p className="text-sm text-muted">No log for this run.</p>
        ) : (
          <details open={run.status === "failed"} className="group rounded-lg border">
            <summary className="cursor-pointer px-4 py-2.5 text-sm text-muted select-none hover:text-foreground">
              <span className="group-open:hidden">Show log</span>
              <span className="hidden group-open:inline">Hide log</span>
            </summary>
            <pre className="max-h-96 overflow-auto border-t bg-panel p-4 font-mono text-xs leading-relaxed">{log}</pre>
          </details>
        )}
      </Section>
    </>
  );
}

function RunAlerts({ run }: { run: Run }) {
  const stoppedAt = failedStep(run);

  return (
    <>
      {run.envChanged && (
        <Alert tone="warning" title="The env changed during this run">
          The deployed commit went from {run.deployedCommitStart ? shortSha(run.deployedCommitStart) : "?"} to {run.deployedCommitEnd ? shortSha(run.deployedCommitEnd) : "?"}. Failures may come from that deploy, not from this feature.
        </Alert>
      )}
      {run.status === "blocked" && run.error && (
        <Alert tone="warning" title={`Blocked${stoppedAt ? ` while ${stoppedAt}` : ""}`}>
          {stripStepPrefix(run.error)}
        </Alert>
      )}
      {run.status === "failed" && run.error && (
        <Alert tone="danger" title={`Failed${stoppedAt ? ` while ${stoppedAt}` : ""}`}>
          {stripStepPrefix(run.error)}
        </Alert>
      )}
    </>
  );
}

function CasesTable({ run, slug, cases }: { run: Run; slug: string; cases: TestCase[] }) {
  if (cases.length === 0) {
    const message = isActive(run.status) ? "Test cases appear once the plan step finishes." : "This run has no test cases.";
    return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted">{message}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-panel text-xs text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Test</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Verdict</th>
            <th className="px-4 py-2.5 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {cases.map((testCase) => (
            <tr key={testCase.id} className="relative hover:bg-hover">
              <td className="px-4 py-3 align-top">
                <CaseStatusBadge status={testCase.status} />
              </td>
              <td className="px-4 py-3 align-top">
                <Link href={`/projects/${slug}/runs/${run.id}/tests/${testCase.id}`} className="font-medium after:absolute after:inset-0">
                  {testCase.title}
                </Link>
                {testCase.kind === "edge" && <span className="ml-2 text-xs text-muted">edge case</span>}
              </td>
              <td className="px-4 py-3 align-top text-muted">{testCase.role}</td>
              <td className="px-4 py-3 align-top">{testCase.verdict ? <VerdictBadge verdict={testCase.verdict} /> : <span className="text-subtle">—</span>}</td>
              <td className="px-4 py-3 text-right align-top text-muted tabular-nums">{testCase.durationMs !== null ? formatDuration(testCase.durationMs) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Alert({ tone, title, children }: { tone: "warning" | "danger"; title: string; children: ReactNode }) {
  const classes = tone === "danger" ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200" : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 break-words">{children}</p>
    </div>
  );
}
