import { requireSession } from "@/lib/server/auth-context";
import { loadOnboarding } from "@/features/onboarding/application/onboarding-status";
import { SetupOverview } from "@/features/onboarding/presentation/SetupOverview";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

export default async function SettingsSetupPage() {
  const ctx = await requireSession();
  const { snapshot } = await loadOnboarding(ctx.token);

  if (!snapshot.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">Set up your workspace</h1>
        <div className="mt-6">
          <InlineError title={snapshot.error.message} referenceId={snapshot.error.referenceId} />
        </div>
      </div>
    );
  }

  return <SetupOverview snapshot={snapshot.value} />;
}
