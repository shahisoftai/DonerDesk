import { requireSession } from "@/lib/server/auth-context";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { InlineError } from "@/components/feedback/PageState";
import { MyWorkList } from "@/features/reports/presentation/MyWorkList";

export const dynamic = "force-dynamic";

export default async function MyWorkPage() {
  const ctx = await requireSession();
  const load = await loadWorkItems(ctx.token);
  if (!load.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">My work</h1>
        <div className="mt-6"><InlineError title={load.error?.message ?? "Could not load your work."} referenceId={load.error?.referenceId} /></div>
      </div>
    );
  }
  const projects = [...load.projectLookup.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">My work</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Assigned reports, compliance gaps, pending evidence reviews, activities, and notifications.
      </p>
      <MyWorkList items={load.items} projects={projects} />
    </div>
  );
}
