import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** "New project" is the Project Creation Wizard, from every entry point (Create menu, Projects page, Home). The earlier one-page form stays at /projects/new/classic. */
export default function NewProjectPage() {
  redirect("/projects/new/wizard");
}
