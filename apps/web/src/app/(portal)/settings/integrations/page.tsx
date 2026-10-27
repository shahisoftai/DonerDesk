import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ApiKeyListSchema, WebhookListSchema } from "@/lib/server/schemas-integrations";
import { InlineError } from "@/components/feedback/PageState";
import { IntegrationsPanel } from "@/features/integrations/presentation/IntegrationsPanel";
import { INTEGRATIONS_COPY as C } from "@/features/integrations/domain/integrations-copy";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "org.manage")) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">{C.title}</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">{C.adminOnly}</div>
      </div>
    );
  }
  const [keys, hooks] = await Promise.all([
    gatewayRequest("/v1/integrations/api-keys", ApiKeyListSchema, ctx.token),
    gatewayRequest("/v1/integrations/webhooks", WebhookListSchema, ctx.token),
  ]);
  if (!keys.ok) return <InlineError title={keys.error.message} referenceId={keys.error.referenceId} />;
  if (!hooks.ok) return <InlineError title={hooks.error.message} referenceId={hooks.error.referenceId} />;
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">{C.title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.intro}</p>
      <IntegrationsPanel keys={keys.value.keys} webhooks={hooks.value.webhooks} />
    </div>
  );
}
