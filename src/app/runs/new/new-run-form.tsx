"use client";

import { useActionState, useState } from "react";
import { Choice, Field, FormError, Select, inputClass } from "@/components/form";
import { buttonClass } from "@/components/page-header";
import { RefCombobox } from "@/components/ref-combobox";
import { startRun } from "@/app/actions";
import { claudeSteps, defaultStepModels, modelChoices, modelLabel, stepLabel } from "@/lib/helpers";
import type { AppOption, FormState } from "@/types/dashboard.types";
import type { Scenario } from "@/types/shared.types";

export function NewRunForm({ apps, initialApp }: { apps: AppOption[]; initialApp?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startRun, {});
  const [appSlug, setAppSlug] = useState(apps.find((option) => option.slug === initialApp)?.slug ?? apps[0]?.slug ?? "");
  const [scenario, setScenario] = useState<Scenario>("codebase");
  const app = apps.find((option) => option.slug === appSlug);

  if (apps.length === 0) {
    return <p className="text-sm text-muted">No projects yet. Add one first.</p>;
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-8">
      <Field label="Project" htmlFor="app">
        <Select id="app" name="app" value={appSlug} onChange={(event) => setAppSlug(event.target.value)}>
          {apps.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </Select>
        {app && (
          <p className="text-xs text-muted">
            Tests run against <span className="font-mono">{app.baseUrl}</span> as {app.roles.join(", ")}.
          </p>
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">What to test</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice name="scenario" value="codebase" checked={scenario === "codebase"} onChange={() => setScenario("codebase")} title="Entire branch" detail="All code on one branch. Routes and a live crawl, core flows first."/>
          <Choice name="scenario" value="feature" checked={scenario === "feature"} onChange={() => setScenario("feature")} title="A feature" detail="A branch, PR or commit range. The diff bounds what gets tested."/>
        </div>
      </fieldset>

      {scenario === "codebase" && (
        <>
          <Field label="Branch" htmlFor="compareRef" hint="Whose code gets tested">
            <BranchPicker key={appSlug} id="compareRef" app={app}/>
          </Field>
          <input type="hidden" name="featureRef" value=""/>
        </>
      )}
      {scenario === "feature" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Feature" htmlFor="featureRef" hint="Branch, PR number or commit range">
            <RefCombobox key={appSlug} id="featureRef" name="featureRef" branches={app?.branches ?? []} commits={app?.commits ?? []} compareBranch={app?.compareBranch ?? "develop"}/>
          </Field>
          <Field label="Compare against" htmlFor="compareRef" hint="Base for the diff">
            <BranchPicker key={appSlug} id="compareRef" app={app}/>
          </Field>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Depth</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice name="depth" value="base" defaultChecked title="Base cases" detail="The main path each change is meant to support."/>
          <Choice name="depth" value="base_edge" title="Base + edge cases" detail="Adds invalid input, empty states, permissions and errors."/>
        </div>
      </fieldset>

      <Field label="Max tests" htmlFor="maxTests" hint="Claude ranks cases by risk and keeps the top N">
        <input id="maxTests" name="maxTests" type="number" min={1} max={100} placeholder="No limit" className={`${inputClass} sm:max-w-40`}/>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          Models
          <span className="ml-2 font-normal text-muted">Write runs the longest, so it drives most of the cost</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {claudeSteps.map((step) => (
            <Field key={step} label={stepLabel(step)} htmlFor={`model-${step}`}>
              <Select id={`model-${step}`} name={step} defaultValue={defaultStepModels[step] ?? "default"}>
                {modelChoices.map((choice) => (
                  <option key={choice} value={choice}>
                    {modelLabel(choice)}
                  </option>
                ))}
                <option value="default">{modelLabel(undefined)}</option>
              </Select>
            </Field>
          ))}
        </div>
      </fieldset>

      <FormError message={state.error}/>

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Starting…" : "Start run"}
        </button>
      </div>
    </form>
  );
}

function BranchPicker({ id, app }: { id: string; app?: AppOption }) {
  const fallback = app?.compareBranch ?? "develop";
  if (!app || app.branches.length === 0) {
    return <input id={id} name="compareRef" defaultValue={fallback} placeholder="develop" className={inputClass}/>;
  }

  const branches = app.branches.includes(fallback) ? app.branches : [fallback, ...app.branches];
  return (
    <Select id={id} name="compareRef" defaultValue={fallback}>
      {branches.map((branch) => (
        <option key={branch} value={branch}>
          {branch}
        </option>
      ))}
    </Select>
  );
}
