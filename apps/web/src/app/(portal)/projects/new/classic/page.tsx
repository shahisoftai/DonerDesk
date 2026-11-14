import { redirect } from "next/navigation";

/** The one-page project form was retired in Version 4.000 (plan F84); every new project starts in the wizard. */
export default function RetiredClassicProjectForm() {
  redirect("/projects/new/wizard");
}
