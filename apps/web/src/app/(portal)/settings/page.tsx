import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { SettingsPanel } from "@/features/settings/presentation/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "settings.view") && !hasCapability(ctx, "org.manage")) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">Settings</h1>
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
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsPanel org={result.value} capabilities={Array.from(ctx.capabilities)} />
    </div>
  );
}
