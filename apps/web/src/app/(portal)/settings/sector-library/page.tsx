import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReviewProgressSchema } from "@/lib/server/schemas-sector-library";
import { InlineError } from "@/components/feedback/PageState";
import { LibraryReviewPanel } from "@/features/sector-library/presentation/LibraryReviewPanel";

export const dynamic = "force-dynamic";

export default async function SectorLibrarySettingsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "org.manage")) return <InlineError title="Only an administrator can review the sector library." />;
  const progress = await gatewayRequest("/v1/sector-library/review/progress", ReviewProgressSchema, ctx.token);
  if (!progress.ok) return <InlineError title={progress.error.message} referenceId={progress.error.referenceId} />;
  return (
    <div className="animate-fade-in">
      <LibraryReviewPanel progress={progress.value} />
    </div>
  );
}
