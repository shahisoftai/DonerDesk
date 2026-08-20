import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema, OrganizationSchema } from "@/lib/server/schemas";
import { REPORT_TYPE_LABEL } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { DriveFolderPanel } from "@/features/evidence/presentation/DriveFolderPanel";

export const dynamic = "force-dynamic";

const IS_STUB = process.env.NODE_ENV !== "production";

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const [result, orgResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${resolvedParams.id}/templates`, TemplatesResponseSchema, ctx.token),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
  ]);
  const driveConnected = orgResult.ok && orgResult.value.storageProvider === "GOOGLE_DRIVE";
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Donor templates</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/templates/new`}>Add template</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Donor templates</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/templates/new`}>Add template</Link>
      </header>
      {IS_STUB && (
        <div className="mt-4">
          <InlineAlert tone="ai" title="Template extraction is a preview">
            Automatic section extraction from files is not enabled yet. You can add a template by pasting its text and
            reviewing the suggested sections, or add sections manually. Anything shown here is a suggestion for your
            review, not source-verified content.
          </InlineAlert>
        </div>
      )}
      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <div className="card text-sm text-slate-600 dark:text-slate-300">No templates yet.</div>
        )}
        {items.map((t) => (
          <Link
            key={t.id}
            href={`/projects/${resolvedParams.id}/templates/${t.id}`}
            className="card flex items-center justify-between transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30"
          >
            <div>
              <div className="font-medium">{t.templateName}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t.donorName} · {REPORT_TYPE_LABEL[t.reportType] ?? t.reportType} · {(t.sections ?? []).length} sections
                {t.version ? ` · v${t.version}` : ""}
              </div>
            </div>
            <span className="text-sm text-brand-600 hover:underline dark:text-brand-400">Edit</span>
          </Link>
        ))}
      </div>

      {driveConnected && (
        <div className="mt-6">
          <DriveFolderPanel
            projectId={resolvedParams.id}
            folderRoles={["01-Donor-Templates"]}
            title="Donor templates in Google Drive"
          />
        </div>
      )}
    </div>
  );
}
