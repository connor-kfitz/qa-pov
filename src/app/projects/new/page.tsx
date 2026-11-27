import { PageHeader } from "@/components/page-header";
import { NewProjectForm } from "./new-project-form";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New project"
        crumbs={[{ href: "/", label: "Projects" }]}
        description="A deployed web app to test: where it lives, where its code is, and which test logins to use. Passwords stay in your local .env."
      />
      <NewProjectForm />
    </>
  );
}
