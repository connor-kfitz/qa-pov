"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { upsertApp } from "@/db/apps";
import { loadAppConfig, saveAppConfig, saveNewAppConfig } from "@/lib/app-config";
import { updateEnvFile } from "@/lib/env-file";
import { claudeSteps, modelChoices, retrySteps, runSteps, slugify, stepLabel } from "@/lib/helpers";
import { launchRunner } from "@/lib/launch-runner";
import { buildAppConfig, parseProjectForm, secretUpdates } from "@/lib/project-input";
import { launchNextQueuedRun, markRunCancelled, requeueRun } from "@/lib/run-queue";
import { getRun } from "@/lib/runs";
import type { FormState, ProjectInput } from "@/types/dashboard.types";
import type { AppConfig, StepModels } from "@/types/shared.types";

const startRunSchema = z.object({
  app: z.string().min(1, "Pick a project."),
  scenario: z.enum(schema.scenarioEnum.enumValues),
  depth: z.enum(schema.depthEnum.enumValues),
  featureRef: z.string().trim(),
  compareRef: z.string().trim(),
  maxTests: z.union([z.literal(""), z.coerce.number().int("Max tests must be a whole number.").min(1, "Max tests must be at least 1.").max(100, "Max tests can be at most 100.")]),
  planning: z.enum(["default", ...modelChoices], "Pick a model for each step."),
  writing: z.enum(["default", ...modelChoices], "Pick a model for each step."),
  repairing: z.enum(["default", ...modelChoices], "Pick a model for each step.")
});

export async function startRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = startRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const input = parsed.data;
  if (input.scenario === "feature" && !input.featureRef) return { error: "A feature run needs a branch, PR or commit range." };

  const app = await loadAppConfig(input.app).catch(() => null);
  if (!app) return { error: `No config found for ${input.app} in qa-apps/.` };

  const models: StepModels = {}
  for (const step of claudeSteps) {
    const choice = input[step];
    if (choice !== "default") models[step] = choice;
  }

  const appRow = await upsertApp(app);
  const [run] = await db
    .insert(schema.runs)
    .values({
      appId: appRow.id,
      scenario: input.scenario,
      depth: input.depth,
      maxTests: input.maxTests === "" ? null : input.maxTests,
      models,
      compareRef: input.compareRef || app.compareBranch,
      featureRef: input.scenario === "feature" ? input.featureRef : null
    })
    .returning();

  launchRunner(run.id);
  revalidatePath("/", "layout");
  redirect(`/projects/${app.slug}/runs/${run.id}`);
}

const retryRunSchema = z.object({
  runId: z.uuid(),
  from: z.enum(runSteps)
});

export async function retryRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = retryRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick a step to retry from." };

  const { runId, from } = parsed.data;
  const found = await getRun(runId);
  if (!found) return { error: "This run no longer exists." };
  if (!retrySteps(found.run).includes(from)) return { error: `This run can't be retried from ${stepLabel(from)}.` };
  if (!(await requeueRun(runId, from, ["failed", "blocked", "cancelled"]))) return { error: "This run is already being retried." };

  launchRunner(runId);
  revalidatePath("/", "layout");
  return {}
}

const cancelRunSchema = z.object({
  runId: z.uuid()
});

export async function cancelRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = cancelRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick a run to cancel." };

  const cancelled = await markRunCancelled(parsed.data.runId);
  if (!cancelled) return { error: "This run already finished." };
  if (cancelled.wasRunning) await launchNextQueuedRun();

  revalidatePath("/", "layout");
  return {}
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseProjectForm(formData);
  if (typeof input === "string") return { error: input };

  const slug = slugify(input.name);
  if (!slug) return { error: "The name needs at least one letter or number." };
  if (slug === "new") return { error: "\"new\" is reserved; pick another name." };

  const config = buildAppConfig(slug, input, null);
  if (await loadAppConfig(slug).catch(() => null)) return { error: `A project with the slug "${slug}" already exists.` };
  const saved = await saveSecrets(config, input);
  if (saved.error) return saved;

  try {
    await saveNewAppConfig(config);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return { error: `A project with the slug "${slug}" already exists.` };
    throw err;
  }
  await upsertApp(config);
  revalidatePath("/", "layout");
  redirect(`/projects/${slug}`);
}

export async function updateProject(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const existing = await loadAppConfig(slug).catch(() => null);
  if (!existing) return { error: `No config found for ${slug} in qa-apps/.` };

  const input = parseProjectForm(formData);
  if (typeof input === "string") return { error: input };

  const config = buildAppConfig(slug, input, existing);
  const saved = await saveSecrets(config, input);
  if (saved.error) return saved;
  await saveAppConfig(config);
  await upsertApp(config);
  revalidatePath("/", "layout");
  redirect(`/projects/${slug}`);
}

async function saveSecrets(config: AppConfig, input: ProjectInput): Promise<FormState> {
  try {
    await updateEnvFile(secretUpdates(config, input, process.env));
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save the credentials to .env." };
  }
}
