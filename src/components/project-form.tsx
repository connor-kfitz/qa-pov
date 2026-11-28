"use client";

import Link from "next/link";

import { useActionState, useState, type ChangeEvent } from "react";
import { createProject, updateProject } from "@/app/actions";
import { Field, FormError, inputClass } from "@/components/form";
import { buttonClass } from "@/components/page-header";
import { bypassSecretEnvName, resolveRoleEnv, savedSecretMask, slugify } from "@/lib/helpers";
import type { EditableProject, FormState, RoleRow } from "@/types/dashboard.types";

const secondaryButtonClass = "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-hover";

export function ProjectForm({ project }: { project?: EditableProject }) {
  const config = project?.config;
  const envSet = project?.envSet ?? {};
  const emails = project?.emails ?? {};
  const [state, formAction, pending] = useActionState<FormState, FormData>(config ? updateProject.bind(null, config.slug) : createProject, {});
  const [fields, setFields] = useState({
    name: config?.name ?? "",
    baseUrl: config?.baseUrl ?? "",
    repoUrl: config?.repoUrl ?? "",
    repoPath: config?.repoPath ?? "",
    compareBranch: config?.compareBranch ?? "develop"
  });
  const [roles, setRoles] = useState<RoleRow[]>(() =>
    config
      ? Object.entries(config.roles).map(([name, role], key) => {
          const saved = "skip" in role ? null : role;
          return {
            key,
            originalName: name,
            name,
            loginUrl: saved?.loginUrl ?? "/login",
            skip: !saved,
            email: saved ? (emails[saved.emailEnv] ?? "") : "",
            password: saved && envSet[saved.passwordEnv] ? savedSecretMask : ""
          }
        })
      : [{ key: 0, name: "admin", loginUrl: "/login", skip: false, email: "", password: "" }]
  );
  const [protectedPreview, setProtectedPreview] = useState(Boolean(config?.bypassSecretEnv));
  const [bypassSecret, setBypassSecret] = useState(config?.bypassSecretEnv && envSet[config.bypassSecretEnv] ? savedSecretMask : "");
  const slug = config?.slug ?? slugify(fields.name);
  const bypassEnv = config?.bypassSecretEnv ?? bypassSecretEnvName(slug || "project");

  const setField = (field: keyof typeof fields) => (event: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [field]: event.target.value });
  const updateRole = (key: number, patch: Partial<RoleRow>) => setRoles(roles.map((role) => (role.key === key ? { ...role, ...patch } : role)));
  const addRole = () => setRoles([...roles, { key: Math.max(-1, ...roles.map((role) => role.key)) + 1, name: "", loginUrl: "/login", skip: false, email: "", password: "" }]);
  const removeRole = (key: number) => setRoles(roles.filter((role) => role.key !== key));

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-8">
      <Field label="Name" htmlFor="name" hint={slug ? `Saved as qa-apps/${slug}.json` : undefined}>
        <input id="name" name="name" value={fields.name} onChange={setField("name")} placeholder="Synergy QMP" className={inputClass} required/>
      </Field>

      <Field label="Live URL" htmlFor="baseUrl" hint="The deployed env tests run against">
        <input id="baseUrl" name="baseUrl" type="url" value={fields.baseUrl} onChange={setField("baseUrl")} placeholder="https://develop.example.com" className={inputClass} required/>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="protectedPreview" checked={protectedPreview} onChange={(event) => setProtectedPreview(event.target.checked)} className="accent-foreground"/>
          Behind Vercel Deployment Protection
        </label>
        {protectedPreview && (
          <SecretInput
            id="bypassSecret"
            name="bypassSecret"
            label="Bypass secret"
            envName={bypassEnv}
            saved={envSet[bypassEnv] ?? false}
            value={bypassSecret}
            onChange={setBypassSecret}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GitHub repo" htmlFor="repoUrl" hint="Optional">
          <input id="repoUrl" name="repoUrl" type="url" value={fields.repoUrl} onChange={setField("repoUrl")} placeholder="https://github.com/org/repo" className={inputClass}/>
        </Field>
        <Field label="Default branch" htmlFor="compareBranch" hint="Deployed to the live URL">
          <input id="compareBranch" name="compareBranch" value={fields.compareBranch} onChange={setField("compareBranch")} className={inputClass} required/>
        </Field>
      </div>

      <Field label="Local repo path" htmlFor="repoPath" hint="Where the runner reads the code">
        <input id="repoPath" name="repoPath" value={fields.repoPath} onChange={setField("repoPath")} placeholder="C:/code/synergy-qmp" className={`${inputClass} font-mono`} required/>
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          Roles
          <span className="ml-2 font-normal text-muted">Tests sign in once per role. Logins are saved to your local .env, never to the project file.</span>
        </legend>
        {roles.map((role) => {
          const previous = role.originalName ? config?.roles[role.originalName] : undefined;
          const env = resolveRoleEnv(slug || "project", role.name || "role", previous);
          return (
            <div key={role.key} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Role" htmlFor={`role-${role.key}`}>
                  <input id={`role-${role.key}`} value={role.name} onChange={(event) => updateRole(role.key, { name: event.target.value })} placeholder="student" className={inputClass} required/>
                </Field>
                <Field label="Login path" htmlFor={`login-${role.key}`}>
                  <input id={`login-${role.key}`} value={role.loginUrl} onChange={(event) => updateRole(role.key, { loginUrl: event.target.value })} disabled={role.skip} className={`${inputClass} disabled:opacity-50`}/>
                </Field>
                <button type="button" onClick={() => removeRole(role.key)} disabled={roles.length === 1} className={`${secondaryButtonClass} disabled:opacity-40`}>
                  Remove
                </button>
              </div>
              {!role.skip && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SecretInput
                    id={`email-${role.key}`}
                    label="Login email"
                    type="email"
                    envName={env.emailEnv}
                    saved={envSet[env.emailEnv] ?? false}
                    value={role.email}
                    onChange={(email) => updateRole(role.key, { email })}
                  />
                  <SecretInput
                    id={`password-${role.key}`}
                    label="Password"
                    envName={env.passwordEnv}
                    saved={envSet[env.passwordEnv] ?? false}
                    value={role.password}
                    onChange={(password) => updateRole(role.key, { password })}
                  />
                </div>
              )}
              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={role.skip} onChange={(event) => updateRole(role.key, { skip: event.target.checked })} className="accent-foreground"/>
                No login (public pages)
              </label>
            </div>
          );
        })}
        <div>
          <button type="button" onClick={addRole} className={secondaryButtonClass}>
            Add role
          </button>
        </div>
      </fieldset>

      <input type="hidden" name="roles" value={JSON.stringify(roles.map(({ originalName, name, loginUrl, skip, email, password }) => ({ originalName, name, loginUrl, skip, email, password })))}/>

      <FormError message={state.error}/>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {config ? (pending ? "Saving…" : "Save changes") : pending ? "Creating…" : "Create project"}
        </button>
        {config && (
          <Link href={`/projects/${config.slug}`} className={secondaryButtonClass}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

function SecretInput({ id, name, label, type = "password", envName, saved, value, onChange }: { id: string; name?: string; label: string; type?: "password" | "email"; envName: string; saved: boolean; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs font-medium">
        {label}
        <span className={`font-normal ${saved ? "text-emerald-700 dark:text-emerald-400" : "text-subtle"}`}>{saved ? "Saved" : "Not set"}</span>
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => value === savedSecretMask && event.target.select()}
        autoComplete={type === "password" ? "new-password" : "off"}
        placeholder={saved ? "Leave blank to keep the saved value" : "Not set yet"}
        className={inputClass}
      />
      <span className="font-mono text-[11px] text-subtle">{envName}</span>
    </div>
  );
}
