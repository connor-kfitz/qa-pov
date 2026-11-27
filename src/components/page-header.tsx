import Link from "next/link";

import type { ReactNode } from "react";
import type { PageHeaderProps } from "@/types/dashboard.types";

export function PageHeader({ title, description, crumbs, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {crumbs && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-subtle">
                  /
                </span>
              )}
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
          {description && <div className="text-sm text-muted">{description}</div>}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-3">{aside}</div>}
      </div>
    </header>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-panel" />
      ))}
    </div>
  );
}

export const buttonClass = "inline-flex items-center justify-center rounded-md bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-85 disabled:opacity-60";

export const panelClass = "rounded-lg border bg-panel";
