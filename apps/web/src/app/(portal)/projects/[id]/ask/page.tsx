import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { AskPanel } from "@/features/ask/presentation/AskPanel";

export const dynamic = "force-dynamic";

export default async function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const org = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  const enabled = org.ok && org.value.askEnabled === true && !ctx.external;
  return (
    <div className="animate-fade-in space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Ask about this project</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Put a question to the project&apos;s recorded values, accepted activities and evidence. Every sentence of the answer names the records it rests on.</p>
      </header>
      {enabled ? <AskPanel projectId={id} /> : (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
          {ctx.external ? "Ask DonorDesk is not available to outside partners." : <>Ask DonorDesk is switched off for this organisation. {ctx.capabilities.has("org.manage") ? <>You can turn it on in <a className="underline" href="/settings">Settings</a>.</> : "An administrator can turn it on in Settings."}</>}
        </p>
      )}
    </div>
  );
}
