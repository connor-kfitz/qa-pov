"use client";

import { useActionState, useState } from "react";
import { cancelRun } from "@/app/actions";
import { FormError } from "@/components/form";
import { secondaryButtonClass } from "@/components/page-header";
import type { FormState } from "@/types/dashboard.types";

export function CancelRunForm({ runId, running }: { runId: string; running: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelRun, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${secondaryButtonClass} py-1.5`}>
        Cancel run
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="runId" value={runId}/>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">{running ? "Stop it? Finished Claude calls stay billed." : "Remove it from the queue?"}</span>
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {pending ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={`${secondaryButtonClass} py-1.5`}>
          Keep running
        </button>
      </div>
      <FormError message={state.error}/>
    </form>
  );
}
