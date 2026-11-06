import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { homeVariantFor } from "@/features/navigation/domain/role-navigation";
import { PortfolioHome } from "@/features/dashboard/presentation/PortfolioHome";
import { FieldHome } from "@/features/dashboard/presentation/FieldHome";
import { ReviewerHome } from "@/features/dashboard/presentation/ReviewerHome";

export const dynamic = "force-dynamic";

/** The one place everyone lands after sign-in; the Home shown is chosen by role (`ROLE_NAVIGATION`). */
export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filter = { by: one(sp.by), key: one(sp.key), alert: one(sp.alert) };
  const ctx = await requireSession();
  // An outside partner has no organisation-wide home: their projects are the page.
  if (ctx.external) redirect("/projects");
  switch (homeVariantFor(ctx.role)) {
    case "DIRECTOR": return <PortfolioHome ctx={ctx} variant="DIRECTOR" filter={filter} />;
    case "MANAGER": return <PortfolioHome ctx={ctx} variant="MANAGER" filter={filter} />;
    case "FIELD": return <FieldHome ctx={ctx} />;
    case "GRANTS": return <ReviewerHome ctx={ctx} variant="GRANTS" />;
    case "COMPLIANCE": return <ReviewerHome ctx={ctx} variant="COMPLIANCE" />;
  }
}
