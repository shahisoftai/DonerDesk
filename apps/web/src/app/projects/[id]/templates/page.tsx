import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Template = { id: string; templateName: string; donorName: string; reportType: string; sections: unknown[] };

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Template[] }>(`/v1/projects/${resolvedParams.id}/templates`, { token }).catch(() => ({ items: [] }));

  return (
    <main className="mx-auto max-w-4xl animate-fade-in px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Donor templates</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/templates/new`}>Upload template</Link>
      </header>
      <div className="mt-6 space-y-3">
        {items.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No templates yet.</div>}
        {items.map((t) => (
          <Link key={t.id} href={`/projects/${resolvedParams.id}/templates/${t.id}`} className="card flex items-center justify-between transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30">
            <div>
              <div className="font-semibold">{t.templateName}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.donorName} · {REPORT_TYPE_LABEL[t.reportType] ?? t.reportType} · {(t.sections as unknown[]).length} sections</div>
            </div>
            <span className="text-sm text-brand-600 hover:underline dark:text-brand-400">Edit</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
