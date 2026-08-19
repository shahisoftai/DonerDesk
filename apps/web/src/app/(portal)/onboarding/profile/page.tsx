import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { SettingsPanel } from "@/features/settings/presentation/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const ctx = await requireSession();

  const result = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Organization profile</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/onboarding" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
        ← Back to setup
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Organization profile</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Confirm your organization details. Donors and reviewers use this information to verify who you are.
      </p>
      <SettingsPanel org={result.value} capabilities={Array.from(ctx.capabilities)} />
    </div>
  );
}
