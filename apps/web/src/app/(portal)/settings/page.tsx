import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MapLayerMetaSchema, OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { SettingsPanel } from "@/features/settings/presentation/SettingsPanel";
import { MapLayerCard } from "@/features/settings/presentation/MapLayerCard";
import { BoundaryLayersCard } from "@/features/settings/presentation/BoundaryLayersCard";
import { BoundaryLayerListSchema } from "@/lib/server/schemas-boundary-layers";
import { PageHeader } from "@/components/layout/Page";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "settings.view") && !hasCapability(ctx, "org.manage")) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Settings</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          You do not have permission to view settings.
        </div>
      </div>
    );
  }

  const result = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Settings</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="page-stack animate-fade-in">
      <PageHeader title="General" description="Your organisation's name, country, language and the defaults every project starts from." actions={<Link href="/settings/billing" className="btn-secondary">Plan and billing</Link>} />
      <SettingsPanel org={result.value} capabilities={Array.from(ctx.capabilities)} />
      {ctx.capabilities.has("org.manage") && (
        <section className="card" aria-labelledby="export-title">
          <h2 id="export-title" className="section-title">Take your data with you</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Download everything your organization has put into DonorDesk — projects, results, activities, evidence records, reports and the audit trail — as one ZIP of readable data files. Passwords and sign-in links are never included.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a className="btn-secondary" href="/api/organization/export">Download records</a>
            <a className="btn-secondary" href="/api/organization/export?files=1">Download records and evidence files</a>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            The version with files can be large and takes longer to prepare. Files kept in Google Drive stay in Drive and are listed in the download.
          </p>
        </section>
      )}
      {ctx.capabilities.has("org.manage") && (
        <>
          <BoundaryLayerSettings />
          <MapLayerSettings />
        </>
      )}
    </div>
  );
}

/** The workspace's own map boundaries (Phase 30.1) — administrators only. */
async function MapLayerSettings() {
  const ctx = await requireSession();
  const layer = await gatewayRequest("/v1/organization/map-layer", MapLayerMetaSchema, ctx.token);
  return <MapLayerCard layer={layer.ok ? layer.value : null} />;
}

/** Boundary files per country and level (Phase 41.7) — administrators only. */
async function BoundaryLayerSettings() {
  const ctx = await requireSession();
  const layers = await gatewayRequest("/v1/organization/boundary-layers", BoundaryLayerListSchema, ctx.token);
  return <BoundaryLayersCard layers={layers.ok ? layers.value.layers : []} />;
}
