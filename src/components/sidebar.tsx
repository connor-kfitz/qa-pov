import Link from "next/link";

import { Suspense } from "react";
import { connection } from "next/server";
import { NavLink } from "@/components/nav-link";
import { navLinkClass } from "@/lib/helpers";
import { RunStatusDot } from "@/components/status-badge";
import { listProjects } from "@/lib/projects";

export function Sidebar() {
  return (
    <aside className="flex shrink-0 flex-col border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-64 md:border-r md:border-b-0">
      <div className="flex h-14 items-center px-5">
        <Link href="/" className="font-semibold tracking-tight">
          qa-pov
        </Link>
      </div>
      <nav className="flex gap-0.5 px-3 md:flex-col">
        <Suspense fallback={<PrimaryLinks />}>
          <PrimaryLinks highlight />
        </Suspense>
      </nav>
      <div className="mt-5 flex min-h-0 flex-col gap-1 pb-3 md:flex-1">
        <h2 className="px-5 text-xs font-semibold tracking-wider text-subtle uppercase">Projects</h2>
        <Suspense fallback={<div className="mx-3 h-8 animate-pulse rounded-md bg-hover" />}>
          <ProjectLinks />
        </Suspense>
      </div>
    </aside>
  );
}

const primaryLinks = [
  { href: "/", label: "All projects", icon: <GridIcon />, exact: true },
  { href: "/runs/new", label: "New run", icon: <PlusIcon />, exact: false }
];

function PrimaryLinks({ highlight }: { highlight?: boolean }) {
  return primaryLinks.map((link) =>
    highlight ? (
      <NavLink key={link.href} href={link.href} exact={link.exact}>
        {link.icon}
        {link.label}
      </NavLink>
    ) : (
      <Link key={link.href} href={link.href} className={navLinkClass(false)}>
        {link.icon}
        {link.label}
      </Link>
    )
  );
}

async function ProjectLinks() {
  await connection();
  const projects = await listProjects();

  if (projects.length === 0) {
    return (
      <Link href="/projects/new" className="px-5 text-sm text-subtle hover:text-foreground">
        None yet. Add a project
      </Link>
    );
  }

  return (
    <nav className="flex gap-0.5 overflow-x-auto px-3 md:flex-col md:overflow-y-auto">
      {projects.map((project) => (
        <NavLink key={project.slug} href={`/projects/${project.slug}`}>
          <RunStatusDot status={project.latestRun?.status ?? null} />
          <span className="truncate">{project.name}</span>
          {project.runCount > 0 && <span className="ml-auto pl-2 text-xs text-subtle tabular-nums">{project.runCount}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
