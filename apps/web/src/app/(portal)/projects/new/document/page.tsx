import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The older document wizard was retired in Phase 65: the Project Creation Wizard reads documents too. Old links open it. */
export default function SetupFromDocumentPage() {
  redirect("/projects/new/wizard");
}
