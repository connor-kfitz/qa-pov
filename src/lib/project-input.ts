import { z } from "zod";
import { bypassSecretEnvName, resolveRoleEnv, savedSecretMask } from "@/lib/helpers";
import type { ProjectInput } from "@/types/dashboard.types";
import type { AppConfig } from "@/types/shared.types";

const roleInputSchema = z.object({
  originalName: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Every role needs a name.")
    .regex(/^[a-z][a-z0-9_-]*$/, "Role names use lowercase letters, numbers, - and _ (e.g. admin)."),
  loginUrl: z.string().trim(),
  skip: z.boolean(),
  email: z.union([z.literal(""), z.email("Check the login email for each role.")]),
  password: z.string()
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name."),
  baseUrl: z.url("Live URL must be a full URL, like https://develop.example.com."),
  repoUrl: z.union([z.literal(""), z.url("GitHub repo must be a full URL, like https://github.com/org/repo.")]),
  repoPath: z.string().trim().min(1, "Add the local repo path so the runner can read the code."),
  compareBranch: z.string().trim().min(1, "Add a default branch."),
  protectedPreview: z.literal("on").optional(),
  bypassSecret: z.string().optional(),
  roles: z.array(roleInputSchema).min(1, "Add at least one role.")
});

export function parseProjectForm(formData: FormData): ProjectInput | string {
  const fields = Object.fromEntries(formData);
  const roles = z.string().transform((raw) => JSON.parse(raw)).safeParse(fields.roles);
  const parsed = projectInputSchema.safeParse({ ...fields, roles: roles.success ? roles.data : [] });
  if (!parsed.success) return parsed.error.issues[0].message;

  const roleNames = parsed.data.roles.map((role) => role.name);
  if (new Set(roleNames).size !== roleNames.length) return "Role names must be unique.";
  return parsed.data;
}

export function buildAppConfig(slug: string, input: ProjectInput, existing: AppConfig | null): AppConfig {
  return {
    slug,
    name: input.name,
    baseUrl: input.baseUrl,
    ...(input.repoUrl && { repoUrl: input.repoUrl }),
    repoPath: input.repoPath,
    compareBranch: input.compareBranch,
    ...(input.protectedPreview && { bypassSecretEnv: existing?.bypassSecretEnv ?? bypassSecretEnvName(slug) }),
    roles: Object.fromEntries(
      input.roles.map((role) => {
        if (role.skip) return [role.name, { skip: true as const }];
        const previous = role.originalName ? existing?.roles[role.originalName] : undefined;
        const selectors = previous && !("skip" in previous) ? previous.selectors : undefined;
        return [role.name, { loginUrl: role.loginUrl || "/login", ...resolveRoleEnv(slug, role.name, previous), ...(selectors && { selectors }) }];
      })
    )
  }
}

export function secretUpdates(config: AppConfig, input: ProjectInput, current: Record<string, string | undefined>) {
  const updates: Record<string, string> = {};
  const set = (name: string, value: string | undefined) => {
    if (value && value !== savedSecretMask && value !== current[name]) updates[name] = value;
  }
  for (const role of input.roles) {
    const saved = config.roles[role.name];
    if (!saved || "skip" in saved) continue;
    set(saved.emailEnv, role.email);
    set(saved.passwordEnv, role.password);
  }
  if (config.bypassSecretEnv) set(config.bypassSecretEnv, input.bypassSecret);
  return updates;
}
