import "server-only";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { AuditLogResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { AuditPanel } from "./AuditPanel";

export async function AuditLogPageContent({ heading = "Audit log" }: { heading?: string }) {
  const ctx = await requireSession();

  if (!hasCapability(ctx, "audit.view")) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          You do not have permission to view the audit log.
        </div>
      </div>
    );
  }

  const result = await gatewayRequest("/v1/audit-log?limit=200", AuditLogResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Sensitive values are redacted in the change summaries below.
      </p>
      <div className="mt-6">
        <AuditPanel records={result.value.items} />
      </div>
    </div>
  );
}
