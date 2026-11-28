"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="size-1.5 animate-pulse rounded-full bg-sky-500"/>
      Updating live
    </span>
  );
}
