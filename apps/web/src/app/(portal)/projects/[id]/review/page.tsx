import { requireSession } from "@/lib/server/auth-context";
import { loadProjectOverviewV2 } from "@/features/projects/application/overview-read-model";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { PageHeader } from "@/components/layout/Page";
import { NeedsYouSection } from "@/features/projects/presentation/overview/NeedsYouSection";

export const dynamic = "force-dynamic";

/** Review (Phase 65): everything on this project that waits for the person, most pressing first. The Home page shows the top few. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const load = await loadProjectOverviewV2(ctx.token, id, { role: ctx.role, capabilities: ctx.capabilities, today, meId: decodeSessionPayload(ctx.token)?.sub ?? "" });
  if (!load.ok || !load.value) return <InlineError title={load.error?.message ?? "This project could not be loaded."} referenceId={load.error?.referenceId} />;
  const { needsYou } = load.value;
  return (
    <div className="page-stack animate-fade-in" data-tour-id="review-queue">
      <PageHeader title="To review" description="What is waiting for you on this project: values to check, files to verify, activities to accept, reports to approve." />
      {needsYou.ok && needsYou.value.length > 0
        ? <NeedsYouSection items={needsYou.value} projectId={id} today={today} />
        : <EmptyState>{needsYou.ok ? "Nothing is waiting for you on this project." : "The review queue is not available right now."}</EmptyState>}
    </div>
  );
}
