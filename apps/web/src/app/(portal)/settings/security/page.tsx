import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MfaStatusSchema } from "@/lib/server/schemas";
import { SecurityPanel } from "@/features/settings/presentation/SecurityPanel";
import { MfaPanel } from "@/features/settings/presentation/MfaPanel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const ctx = await requireSession();
  const mfa = await gatewayRequest("/v1/auth/mfa", MfaStatusSchema, ctx.token);
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Security</h1>
      <div className="mt-6 max-w-xl space-y-4">
        {mfa.ok && <MfaPanel enabled={mfa.value.enabled} enabledAt={mfa.value.enabledAt} recoveryCodesLeft={mfa.value.recoveryCodesLeft} />}
      </div>
      <SecurityPanel />
    </div>
  );
}
