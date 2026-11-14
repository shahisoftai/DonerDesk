import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** "New project" is the Project Creation Wizard, from every entry point (Create menu, Projects page, Home). The one-page form was retired in Version 4.000 and /projects/new/classic redirects here too. */
export default function NewProjectPage() {
  redirect("/projects/new/wizard");
}
