import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type Project = {
  id: string; title: string; projectCode: string; donorName: string; country: string; sector: string;
  status: string; reportingFrequency: string; startDate: string; endDate: string; daysRemaining: number;
};

type Template = { id: string; templateName: string; donorName: string; reportType: string; sections: unknown[] };

type Logframe = { items: Array<{ id: string; level: string; code?: string; title: string }>; indicators: Array<{ id: string; code: string; name: string; baseline: string; target: string }> };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [project, templates, logframe, activities] = await Promise.all([
    api<Project>(`/v1/projects/${resolvedParams.id}`, { token }).catch(() => null),
    api<{ items: Template[] }>(`/v1/projects/${resolvedParams.id}/templates`, { token }).catch(() => ({ items: [] })),
    api<Logframe>(`/v1/projects/${resolvedParams.id}/logframe`, { token }).catch(() => ({ items: [], indicators: [] })),
    api<{ items: unknown[] }>(`/v1/projects/${resolvedParams.id}/activities`, { token }).catch(() => ({ items: [] })),
  ]);

  if (!project) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <div className="text-sm text-slate-500">{project.donorName} · {project.country} · {project.sector.replace(/_/g, " ")}</div>
        </div>
        <div className="flex gap-2">
          <span className={`tag ${project.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>{project.status}</span>
          <span className="tag tag-slate">{project.reportingFrequency.toLowerCase().replace("_", " ")}</span>
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-sm">
        <Tab href={`/projects/${project.id}`} label="Overview" active />
        <Tab href={`/projects/${project.id}/templates`} label="Templates" />
        <Tab href={`/projects/${project.id}/logframe`} label="Logframe" />
        <Tab href={`/projects/${project.id}/activities`} label="Activities" />
        <Tab href={`/projects/${project.id}/evidence`} label="Evidence" />
        <Tab href={`/projects/${project.id}/reports`} label="Reports" />
        <Tab href={`/projects/${project.id}/compliance`} label="Compliance" />
      </nav>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Days remaining" value={String(project.daysRemaining)} />
        <Stat label="Indicators" value={String(logframe.indicators.length)} />
        <Stat label="Activities" value={String(activities.items.length)} />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Donor templates</h2>
          <p className="text-sm text-slate-500">Structured reporting templates for this project.</p>
          <ul className="mt-3 space-y-2">
            {templates.items.length === 0 && <li className="text-sm text-slate-500">No templates yet. <Link className="text-brand-600 hover:underline" href={`/projects/${project.id}/templates`}>Upload one</Link>.</li>}
            {templates.items.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.templateName} <span className="text-xs text-slate-500">· {t.reportType.toLowerCase().replace("_", " ")}</span></span>
                <Link className="text-brand-600 hover:underline" href={`/projects/${project.id}/templates/${t.id}`}>Edit sections</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="font-semibold">Logframe</h2>
          <p className="text-sm text-slate-500">Hierarchical goals, outputs, and indicators.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {logframe.items.length === 0 && <li className="text-slate-500">No logframe items yet.</li>}
            {logframe.items.slice(0, 6).map((i) => (
              <li key={i.id}><span className="font-mono text-xs">{i.level}</span> — {i.title}</li>
            ))}
          </ul>
          <Link className="mt-3 inline-block text-sm text-brand-600 hover:underline" href={`/projects/${project.id}/logframe`}>Manage logframe</Link>
        </div>
      </section>
    </main>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`rounded-md px-3 py-1.5 ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>{label}</Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
