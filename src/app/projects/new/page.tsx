import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/components/project-form";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New project"
        crumbs={[{ href: "/", label: "Projects" }]}
        description="A deployed web app to test: where it lives, where its code is, and which test logins to use. Passwords stay in your local .env."
      />
      <ProjectForm/>
    </>
  );
}
