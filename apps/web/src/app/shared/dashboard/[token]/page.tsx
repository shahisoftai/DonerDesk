import type { Metadata } from "next";
import { apiBaseUrl } from "@/lib/server/api-gateway";
import { PublicDashboardSchema } from "@/lib/server/schemas-dashboards";
import { PublicDashboard } from "@/features/dashboards/presentation/PublicDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared dashboard", robots: { index: false, follow: false } };

async function read(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  try {
    const response = await fetch(`${apiBaseUrl()}/public/dashboards/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = PublicDashboardSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** What a person with a dashboard link sees: the charts as they stand now. No sign-in; the link is the credential. */
export default async function SharedDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dashboard = await read(token);
  if (!dashboard) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">This link is not available</h1>
        <p className="mt-2 text-sm text-slate-500">It may have expired or been withdrawn. Ask the person who sent it for a new one.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{dashboard.name}</h1>
      <p className="mt-1 text-xs text-slate-500">Read-only. The figures are drawn from the recorded values each time this page opens, and maps show the work plan and results by place as they stand. Money, budgets and lists of projects are not shown.</p>
      <div className="mt-4"><PublicDashboard widgets={dashboard.widgets as never} charts={dashboard.charts} /></div>
    </main>
  );
}
