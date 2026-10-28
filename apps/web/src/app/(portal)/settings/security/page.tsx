import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MfaStatusSchema, TeamResponseSchema } from "@/lib/server/schemas";
import { MfaRequirementCard } from "@/features/settings/presentation/MfaRequirementCard";
import { SecurityPanel } from "@/features/settings/presentation/SecurityPanel";
import { MfaPanel } from "@/features/settings/presentation/MfaPanel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const ctx = await requireSession();
  const mfa = await gatewayRequest("/v1/auth/mfa", MfaStatusSchema, ctx.token);
  const canManage = ctx.capabilities.has("org.manage");
  const team = canManage ? await gatewayRequest("/v1/users", TeamResponseSchema, ctx.token) : null;
  const people = team?.ok ? team.value.items.filter((m) => m.status !== "REMOVED" && m.status !== "SUSPENDED") : null;
  const setupRequired = mfa.ok && mfa.value.requirement === "SETUP_REQUIRED";
  const soon = mfa.ok && mfa.value.requirement === "REQUIRED_SOON";
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Security</h1>
      <div className="mt-6 max-w-xl space-y-4">
        {setupRequired && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">Your organization requires two-step sign-in. Set it up below to continue; you will sign in again afterwards.</p>}
        {soon && mfa.ok && mfa.value.requiredFrom && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">Your organization will require two-step sign-in from {new Date(mfa.value.requiredFrom).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Set it up now to avoid being interrupted.</p>}
        {mfa.ok && <MfaPanel signOutAfterEnable={setupRequired} enabled={mfa.value.enabled} enabledAt={mfa.value.enabledAt} recoveryCodesLeft={mfa.value.recoveryCodesLeft} />}
      </div>
      {canManage && mfa.ok && (
        <div className="mt-6 max-w-xl">
          <MfaRequirementCard
            requiredFrom={mfa.value.requiredFrom}
            ownEnabled={mfa.value.enabled}
            withoutCount={people ? people.filter((m) => !m.mfaEnabled).length : null}
            total={people ? people.length : null}
            ssoManaged={process.env.AUTH_PROVIDER === "oidc"}
          />
        </div>
      )}
      <SecurityPanel />
    </div>
  );
}
