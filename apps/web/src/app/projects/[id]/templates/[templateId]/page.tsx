import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import { SectionEditor } from "./SectionEditor";

export const dynamic = "force-dynamic";

type Section = { id: string; title: string; description: string; inputType: string; required: boolean; evidenceNeeded: string };

export default async function TemplateEditor({ params }: { params: Promise<{ id: string; templateId: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Array<{ id: string; templateName: string; sections: Section[] }> }>(`/v1/projects/${resolvedParams.id}/templates`, { token }).catch(() => ({ items: [] }));
  const tpl = items.find((t) => t.id === resolvedParams.templateId);
  if (!tpl) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Template not found.</div>;
  return (
    <main className="mx-auto max-w-4xl animate-fade-in px-6 py-8">
      <h1 className="text-2xl font-bold">{tpl.templateName}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">Review and edit AI-extracted sections before saving.</p>
      <SectionEditor projectId={resolvedParams.id} templateId={tpl.id} initialSections={tpl.sections} />
    </main>
  );
}
