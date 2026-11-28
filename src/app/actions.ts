"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { upsertApp } from "@/db/apps";
import { loadAppConfig, saveNewAppConfig } from "@/lib/app-config";
import { bypassSecretEnvName, retrySteps, roleEnvNames, runSteps, slugify, stepLabel } from "@/lib/helpers";
import { launchRunner } from "@/lib/launch-runner";
import { requeueRun } from "@/lib/run-queue";
import { getRun } from "@/lib/runs";
import type { FormState } from "@/types/dashboard.types";
import type { AppConfig } from "@/types/shared.types";

const startRunSchema = z.object({
  app: z.string().min(1, "Pick a project."),
  scenario: z.enum(schema.scenarioEnum.enumValues),
  depth: z.enum(schema.depthEnum.enumValues),
  featureRef: z.string().trim(),
  compareRef: z.string().trim(),
  maxTests: z.union([z.literal(""), z.coerce.number().int("Max tests must be a whole number.").min(1, "Max tests must be at least 1.").max(100, "Max tests can be at most 100.")])
});

export async function startRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = startRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const input = parsed.data;
  if (input.scenario === "feature" && !input.featureRef) return { error: "A feature run needs a branch, PR or commit range." };

  const app = await loadAppConfig(input.app).catch(() => null);
  if (!app) return { error: `No config found for ${input.app} in qa-apps/.` };

  const appRow = await upsertApp(app);
  const [run] = await db
    .insert(schema.runs)
    .values({
      appId: appRow.id,
      scenario: input.scenario,
      depth: input.depth,
      maxTests: input.maxTests === "" ? null : input.maxTests,
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
  if (!(await requeueRun(runId, from, ["failed", "blocked"]))) return { error: "This run is already being retried." };

  launchRunner(runId);
  revalidatePath("/", "layout");
  return {}
}

const roleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Every role needs a name.")
    .regex(/^[a-z][a-z0-9_-]*$/, "Role names use lowercase letters, numbers, - and _ (e.g. admin)."),
  loginUrl: z.string().trim(),
  skip: z.boolean()
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name."),
  baseUrl: z.url("Live URL must be a full URL, like https://develop.example.com."),
  repoUrl: z.union([z.literal(""), z.url("GitHub repo must be a full URL, like https://github.com/org/repo.")]),
  repoPath: z.string().trim().min(1, "Add the local repo path so the runner can read the code."),
  compareBranch: z.string().trim().min(1, "Add a default branch."),
  protectedPreview: z.literal("on").optional(),
  roles: z.array(roleInputSchema).min(1, "Add at least one role.")
});

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = Object.fromEntries(formData);
  const roles = z.string().transform((raw) => JSON.parse(raw)).safeParse(fields.roles);
  const parsed = createProjectSchema.safeParse({ ...fields, roles: roles.success ? roles.data : [] });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const input = parsed.data;
  const slug = slugify(input.name);
  if (!slug) return { error: "The name needs at least one letter or number." };
  if (slug === "new") return { error: "\"new\" is reserved; pick another name." };

  const roleNames = input.roles.map((role) => role.name);
  if (new Set(roleNames).size !== roleNames.length) return { error: "Role names must be unique." };

  const config: AppConfig = {
    slug,
    name: input.name,
    baseUrl: input.baseUrl,
    ...(input.repoUrl && { repoUrl: input.repoUrl }),
    repoPath: input.repoPath,
    compareBranch: input.compareBranch,
    ...(input.protectedPreview && { bypassSecretEnv: bypassSecretEnvName(slug) }),
    roles: Object.fromEntries(input.roles.map((role) => [role.name, role.skip ? { skip: true as const } : { loginUrl: role.loginUrl || "/login", ...roleEnvNames(slug, role.name) }]))
  }

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
