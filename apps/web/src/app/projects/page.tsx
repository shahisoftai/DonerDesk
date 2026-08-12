import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type Project = { id: string; title: string; donorName: string; country: string; status: string; reportingFrequency: string; daysRemaining: number };

export default async function ProjectsList() {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Project[] }>("/v1/projects", { token }).catch(() => ({ items: [] }));
  return (
    <main className="mx-auto max-w-5xl animate-fade-in px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link className="btn" href="/projects/new">New project</Link>
      </header>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No projects yet.</div>}
        {items.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{p.title}</div>
              <span className={`tag shrink-0 ${p.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>{p.status}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.donorName} · {p.country}</div>
            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">{p.daysRemaining} days remaining · {p.reportingFrequency.toLowerCase().replace("_", " ")}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
