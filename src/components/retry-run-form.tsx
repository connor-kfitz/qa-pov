"use client";

import { useActionState } from "react";
import { retryRun } from "@/app/actions";
import { FormError, Select } from "@/components/form";
import { buttonClass } from "@/components/page-header";
import { stepLabel } from "@/lib/helpers";
import type { FormState } from "@/types/dashboard.types";
import type { RunStatus } from "@/types/shared.types";

export function RetryRunForm({ runId, steps }: { runId: string; steps: RunStatus[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(retryRun, {});

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="runId" value={runId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="retry-from" className="text-sm">
          Retry from
        </label>
        <div className="w-36">
          <Select id="retry-from" name="from" defaultValue={steps.at(-1)} className="bg-background py-1.5 text-foreground">
            {steps.map((step) => (
              <option key={step} value={step}>
                {stepLabel(step)}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass} py-1.5`}>
          {pending ? "Queuing…" : "Retry"}
        </button>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
