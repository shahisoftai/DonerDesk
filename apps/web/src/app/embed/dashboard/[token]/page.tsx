import type { Metadata } from "next";
import { apiBaseUrl } from "@/lib/server/api-gateway";
import { PublicDashboardSchema } from "@/lib/server/schemas-dashboards";
import { PublicDashboard } from "@/features/dashboards/presentation/PublicDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

/** The same read-only dashboard with no heading or page chrome, for placing inside another page with an iframe. */
export default async function EmbeddedDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let dashboard = null;
  if (/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    try {
      const response = await fetch(`${apiBaseUrl()}/public/dashboards/${encodeURIComponent(token)}`, { cache: "no-store" });
      const parsed = response.ok ? PublicDashboardSchema.safeParse(await response.json()) : null;
      dashboard = parsed?.success ? parsed.data : null;
    } catch {
      dashboard = null;
    }
  }
  if (!dashboard) return <p className="p-4 text-center text-sm text-slate-500">This link is not available.</p>;
  return <div className="p-2"><PublicDashboard widgets={dashboard.widgets as never} charts={dashboard.charts} /></div>;
}
