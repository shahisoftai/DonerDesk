import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { SettingsPanel } from "@/features/settings/presentation/SettingsPanel";
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
      <SettingsPanel org={result.value} capabilities={Array.from(ctx.capabilities)} />
    </div>
  );
}
