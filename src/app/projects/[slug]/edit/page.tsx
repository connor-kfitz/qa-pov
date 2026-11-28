import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Skeleton } from "@/components/page-header";
import { ProjectForm } from "@/components/project-form";
import { loadAppConfig } from "@/lib/app-config";
import { envIsSet, envValues } from "@/lib/env-file";

export default function EditProjectPage({ params }: PageProps<"/projects/[slug]/edit">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <EditProject params={params} />
    </Suspense>
  );
}

async function EditProject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const config = await loadAppConfig(slug).catch(() => null);
  if (!config) notFound();

  const loginRoles = Object.values(config.roles).flatMap((role) => ("skip" in role ? [] : [role]));
  const emailNames = loginRoles.map((role) => role.emailEnv);
  const secretNames = [config.bypassSecretEnv, ...loginRoles.map((role) => role.passwordEnv)].filter((name): name is string => Boolean(name));

  return (
    <>
      <PageHeader
        title={`Edit ${config.name}`}
        crumbs={[
          { href: "/", label: "Projects" },
          { href: `/projects/${slug}`, label: config.name }
        ]}
        description="Changes apply to future runs; past runs keep the settings they ran with. Saved passwords stay hidden; type over one to replace it."
      />
      <ProjectForm project={{ config, envSet: envIsSet([...emailNames, ...secretNames]), emails: envValues(emailNames) }} />
    </>
  );
}
