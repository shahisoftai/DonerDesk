import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MapLayerMetaSchema, OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { SettingsPanel } from "@/features/settings/presentation/SettingsPanel";
import { MapLayerCard } from "@/features/settings/presentation/MapLayerCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "settings.view") && !hasCapability(ctx, "org.manage")) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
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
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <Link
          href="/settings/billing"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-400 hover:text-brand-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:text-brand-300"
        >
          Plan &amp; billing
        </Link>
      </div>
      {ctx.capabilities.has("template.edit") && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          <Link className="font-medium underline" href="/settings/requirement-packs">Donor requirements</Link>: list what a donor requires of a report so it is checked before approval.
        </p>
      )}
      <SettingsPanel org={result.value} capabilities={Array.from(ctx.capabilities)} />
      {ctx.capabilities.has("org.manage") && (
        <section className="card mt-6 max-w-2xl" aria-labelledby="export-title">
          <h2 id="export-title" className="text-sm font-semibold">Take your data with you</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Download everything your organization has put into DonorDesk — projects, results, activities, evidence records, reports and the audit trail — as one ZIP of readable data files. Passwords and sign-in links are never included.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a className="btn" href="/api/organization/export">Download records</a>
            <a className="btn" href="/api/organization/export?files=1">Download records and evidence files</a>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            The version with files can be large and takes longer to prepare. Files kept in Google Drive stay in Drive and are listed in the download.
          </p>
        </section>
      )}
      {ctx.capabilities.has("org.manage") && (
        <MapLayerSettings />
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
