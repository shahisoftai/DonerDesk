import { requireSession } from "@/lib/server/auth-context";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { ImportGuide } from "@/features/imports/presentation/ImportGuide";

export const dynamic = "force-dynamic";

/** Bring in data: one place to start any import. Each import keeps its own checks; this page only points at the right one. */
export default async function BringInDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const allowed = ctx.capabilities.has("indicator.update") || ctx.capabilities.has("project.edit");
  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight">Bring in data</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">A file, a pasted table or a form: say what you have and we will take you to the screen that reads it. Every import checks each row before anything is saved.</p>
      <div className="mt-5">
        {allowed ? <ImportGuide projectId={id} /> : <InlineAlert tone="info" title="You can look but not import">Your role cannot bring data into this project. Ask a project manager for access.</InlineAlert>}
      </div>
    </div>
  );
}
