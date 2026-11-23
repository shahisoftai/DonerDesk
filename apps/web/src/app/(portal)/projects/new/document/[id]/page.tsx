import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Retired in Phase 65 (see `../page.tsx`). Setups started there stay readable through the wizard's own draft list. */
export default function SetupReviewPage() {
  redirect("/projects/new/wizard");
}
