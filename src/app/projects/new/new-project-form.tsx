"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Field, FormError, inputClass } from "@/components/form";
import { buttonClass } from "@/components/page-header";
import { createProject } from "@/app/actions";
import { bypassSecretEnvName, roleEnvNames, slugify } from "@/lib/helpers";
import type { FormState, RoleRow } from "@/types/dashboard.types";

const secondaryButtonClass = "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-hover";

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProject, {});
  const [fields, setFields] = useState({ name: "", baseUrl: "", repoUrl: "", repoPath: "", compareBranch: "develop" });
  const [roles, setRoles] = useState<RoleRow[]>([{ key: 0, name: "admin", loginUrl: "/login", skip: false }]);
  const [protectedPreview, setProtectedPreview] = useState(false);
  const slug = slugify(fields.name);

  const setField = (field: keyof typeof fields) => (event: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [field]: event.target.value });
  const updateRole = (key: number, patch: Partial<RoleRow>) => setRoles(roles.map((role) => (role.key === key ? { ...role, ...patch } : role)));
  const addRole = () => setRoles([...roles, { key: Math.max(-1, ...roles.map((role) => role.key)) + 1, name: "", loginUrl: "/login", skip: false }]);
  const removeRole = (key: number) => setRoles(roles.filter((role) => role.key !== key));

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-8">
      <Field label="Name" htmlFor="name" hint={slug ? `Saved as qa-apps/${slug}.json` : undefined}>
        <input id="name" name="name" value={fields.name} onChange={setField("name")} placeholder="Synergy QMP" className={inputClass} required />
      </Field>

      <Field label="Live URL" htmlFor="baseUrl" hint="The deployed env tests run against">
        <input id="baseUrl" name="baseUrl" type="url" value={fields.baseUrl} onChange={setField("baseUrl")} placeholder="https://develop.example.com" className={inputClass} required />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="protectedPreview" checked={protectedPreview} onChange={(event) => setProtectedPreview(event.target.checked)} className="accent-foreground" />
            Behind Vercel Deployment Protection
          </label>
          {protectedPreview && (
            <span>
              Bypass secret from <code className="font-mono">.env</code>: <code className="font-mono">{bypassSecretEnvName(slug || "project")}</code>
            </span>
          )}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GitHub repo" htmlFor="repoUrl" hint="Optional">
          <input id="repoUrl" name="repoUrl" type="url" value={fields.repoUrl} onChange={setField("repoUrl")} placeholder="https://github.com/org/repo" className={inputClass} />
        </Field>
        <Field label="Default branch" htmlFor="compareBranch" hint="Deployed to the live URL">
          <input id="compareBranch" name="compareBranch" value={fields.compareBranch} onChange={setField("compareBranch")} className={inputClass} required />
        </Field>
      </div>

      <Field label="Local repo path" htmlFor="repoPath" hint="Where the runner reads the code">
        <input id="repoPath" name="repoPath" value={fields.repoPath} onChange={setField("repoPath")} placeholder="C:/code/synergy-qmp" className={`${inputClass} font-mono`} required />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          Roles
          <span className="ml-2 font-normal text-muted">Tests sign in once per role</span>
        </legend>
        {roles.map((role) => {
          const env = roleEnvNames(slug || "project", role.name || "role");
          return (
            <div key={role.key} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Role" htmlFor={`role-${role.key}`}>
                  <input id={`role-${role.key}`} value={role.name} onChange={(event) => updateRole(role.key, { name: event.target.value })} placeholder="student" className={inputClass} required />
                </Field>
                <Field label="Login path" htmlFor={`login-${role.key}`}>
                  <input id={`login-${role.key}`} value={role.loginUrl} onChange={(event) => updateRole(role.key, { loginUrl: event.target.value })} disabled={role.skip} className={`${inputClass} disabled:opacity-50`} />
                </Field>
                <button type="button" onClick={() => removeRole(role.key)} disabled={roles.length === 1} className={`${secondaryButtonClass} disabled:opacity-40`}>
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={role.skip} onChange={(event) => updateRole(role.key, { skip: event.target.checked })} className="accent-foreground" />
                  No login (public pages)
                </label>
                {!role.skip && (
                  <span>
                    Credentials from <code className="font-mono">.env</code>: <code className="font-mono">{env.emailEnv}</code>, <code className="font-mono">{env.passwordEnv}</code>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div>
          <button type="button" onClick={addRole} className={secondaryButtonClass}>
            Add role
          </button>
        </div>
      </fieldset>

      <input type="hidden" name="roles" value={JSON.stringify(roles.map(({ name, loginUrl, skip }) => ({ name, loginUrl, skip })))} />

      <FormError message={state.error} />

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
