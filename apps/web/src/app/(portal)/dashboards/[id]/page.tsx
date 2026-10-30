import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { DashboardDataSchema, DashboardSchema } from "@/lib/server/schemas-dashboards";
import { InlineError } from "@/components/feedback/PageState";
import { DashboardView } from "@/features/dashboards/presentation/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [dashboard, data, projects] = await Promise.all([
    gatewayRequest(`/v1/dashboards/${encodeURIComponent(id)}`, DashboardSchema, ctx.token),
    gatewayRequest(`/v1/dashboards/${encodeURIComponent(id)}/data`, DashboardDataSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  if (!dashboard.ok) return <InlineError title={dashboard.error.message} referenceId={dashboard.error.referenceId} />;
  const names = Object.fromEntries((projects.ok ? projects.value.items : []).map((p) => [p.id, p.title]));
  return (
    <div className="animate-fade-in space-y-3">
      <p className="text-xs"><Link className="hover:underline" href="/dashboards">Dashboards</Link></p>
      {!data.ok && <InlineError title={data.error.message} referenceId={data.error.referenceId} />}
      <DashboardView dashboard={dashboard.value} charts={data.ok ? data.value.charts : []} periods={data.ok ? data.value.periods : []} projectNames={names} />
    </div>
  );
}
