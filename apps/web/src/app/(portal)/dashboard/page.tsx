import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { landsInFieldApp } from "@/features/navigation/domain/phone-landing";
import { homeVariantFor } from "@/features/navigation/domain/role-navigation";
import { PortfolioHome } from "@/features/dashboard/presentation/PortfolioHome";
import { FieldHome } from "@/features/dashboard/presentation/FieldHome";
import { ReviewerHome } from "@/features/dashboard/presentation/ReviewerHome";
import { PartnerHome } from "@/features/dashboard/presentation/PartnerHome";

export const dynamic = "force-dynamic";

/** The one place everyone lands after sign-in; the Home shown is chosen by role (`ROLE_NAVIGATION`). */
export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filter = { by: one(sp.by), key: one(sp.key), alert: one(sp.alert) };
  const ctx = await requireSession();
  // An outside partner has no organisation-wide home: their projects and what is next on each (plan F37).
  if (ctx.external) return <PartnerHome ctx={ctx} />;
  // A field officer on a phone lands in the field app, which is made for the phone and works with no signal; "Open the online home page" there adds ?stay=1.
  if (landsInFieldApp({ homeVariant: homeVariantFor(ctx.role), userAgent: (await headers()).get("user-agent"), stay: one(sp.stay) })) redirect("/field");
  switch (homeVariantFor(ctx.role)) {
    case "DIRECTOR": return <PortfolioHome ctx={ctx} variant="DIRECTOR" filter={filter} />;
    case "MANAGER": return <PortfolioHome ctx={ctx} variant="MANAGER" filter={filter} />;
    case "FIELD": return <FieldHome ctx={ctx} />;
    case "GRANTS": return <ReviewerHome ctx={ctx} variant="GRANTS" />;
    case "COMPLIANCE": return <ReviewerHome ctx={ctx} variant="COMPLIANCE" />;
  }
}
