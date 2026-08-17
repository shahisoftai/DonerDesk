import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema } from "@/lib/server/schemas";
import { SectionEditor } from "./SectionEditor";

export const dynamic = "force-dynamic";

export default async function TemplateEditor({ params }: { params: Promise<{ id: string; templateId: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${resolvedParams.id}/templates`, TemplatesResponseSchema, ctx.token);
  if (!result.ok) {
    return <div className="animate-fade-in"><p className="text-sm text-red-600 dark:text-red-400">{result.error.message}</p></div>;
  }
  const tpl = result.value.items.find((t) => t.id === resolvedParams.templateId);
  if (!tpl) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Template not found.</div>;
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">{tpl.templateName}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">Review and confirm the sections that will shape reports for this donor. These are your own confirmed sections, not source-verified extractions. Mark the required sections as reviewed and save to unlock reporting periods.</p>
      <SectionEditor
        projectId={resolvedParams.id}
        templateId={tpl.id}
        initialSections={(tpl.sections ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          inputType: s.inputType,
          required: s.required ?? true,
          evidenceNeeded: s.evidenceNeeded ?? "",
          reviewStatus: s.reviewStatus ?? "DRAFT",
          minWords: s.minWords,
          maxWords: s.maxWords,
        }))}
      />
    </div>
  );
}
