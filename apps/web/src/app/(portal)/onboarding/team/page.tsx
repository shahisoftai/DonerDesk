import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TeamResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { TeamPanel } from "@/features/team/presentation/TeamPanel";

export const dynamic = "force-dynamic";

export default async function OnboardingTeamPage() {
  const ctx = await requireSession();

  const result = await gatewayRequest("/v1/users", TeamResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">Invite your team</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/onboarding" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
        ← Back to setup
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Invite your team</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Add teammates with the right roles so they can contribute to reporting.
      </p>
      <div className="mt-6">
        <TeamPanel members={result.value.items} capabilities={Array.from(ctx.capabilities)} />
      </div>
    </div>
  );
}
